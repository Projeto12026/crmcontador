-- =============================================
-- CARTAO DE CREDITO + VENCIMENTOS
-- Modelo: financial_accounts (type=credit) <-> credit_cards
--         credit_cards 1:N credit_card_invoices
--         credit_card_invoices 1:N cash_flow_transactions
-- =============================================

-- 1. Tabela credit_cards (entidade rica vinculada 1:1 com financial_accounts)
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_account_id UUID NOT NULL UNIQUE
    REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  brand TEXT,
  credit_limit NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access for credit_cards"
  ON public.credit_cards FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_credit_cards_account
  ON public.credit_cards(financial_account_id);

-- Garante que a financial_accounts vinculada e sempre type='credit'
CREATE OR REPLACE FUNCTION public.credit_cards_validate_account()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT type::TEXT INTO v_type
    FROM public.financial_accounts
   WHERE id = NEW.financial_account_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'financial_account % nao encontrada', NEW.financial_account_id;
  END IF;

  IF v_type <> 'credit' THEN
    RAISE EXCEPTION 'financial_account % nao e do tipo credit (atual: %)', NEW.financial_account_id, v_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credit_cards_validate_account_trg
  BEFORE INSERT OR UPDATE OF financial_account_id ON public.credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_cards_validate_account();

-- 2. Enum + tabela credit_card_invoices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM ('aberta', 'fechada', 'paga', 'atrasada');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_card_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  period_year SMALLINT NOT NULL,
  period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'aberta',
  paid_date DATE,
  payment_transaction_id UUID, -- FK adicionada apos extender cash_flow_transactions
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credit_card_id, period_year, period_month)
);

ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access for credit_card_invoices"
  ON public.credit_card_invoices FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_credit_card_invoices_updated_at
  BEFORE UPDATE ON public.credit_card_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_credit_invoices_card
  ON public.credit_card_invoices(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_period
  ON public.credit_card_invoices(credit_card_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_due
  ON public.credit_card_invoices(due_date);

-- 3. Funcao para calcular fatura de uma compra
-- Regra:
--   Se purchase_day <= closing_day: compra entra na fatura que fecha esse mes.
--   Senao: compra entra na fatura que fecha no mes seguinte.
--   due_date:
--     Se due_day >= closing_day: vence no mesmo mes do fechamento.
--     Senao: vence no mes seguinte ao fechamento.
--   Dias acima do ultimo dia do mes sao clampados.
CREATE OR REPLACE FUNCTION public.compute_invoice_for_card(
  p_card_id UUID,
  p_purchase_date DATE
)
RETURNS TABLE (
  out_period_year SMALLINT,
  out_period_month SMALLINT,
  out_closing_date DATE,
  out_due_date DATE
) AS $$
DECLARE
  v_closing_day INT;
  v_due_day INT;
  v_purchase_day INT;
  v_year INT;
  v_month INT;
  v_closing_month_first DATE;
  v_closing_last_day INT;
  v_due_month_first DATE;
  v_due_last_day INT;
BEGIN
  SELECT cc.closing_day, cc.due_day
    INTO v_closing_day, v_due_day
    FROM public.credit_cards cc
   WHERE cc.id = p_card_id;

  IF v_closing_day IS NULL THEN
    RAISE EXCEPTION 'Cartao % nao encontrado', p_card_id;
  END IF;

  v_purchase_day := EXTRACT(DAY FROM p_purchase_date)::INT;
  v_year := EXTRACT(YEAR FROM p_purchase_date)::INT;
  v_month := EXTRACT(MONTH FROM p_purchase_date)::INT;

  IF v_purchase_day > v_closing_day THEN
    v_month := v_month + 1;
    IF v_month > 12 THEN
      v_month := 1;
      v_year := v_year + 1;
    END IF;
  END IF;

  v_closing_month_first := make_date(v_year, v_month, 1);
  v_closing_last_day := EXTRACT(DAY FROM (v_closing_month_first + INTERVAL '1 month - 1 day')::DATE)::INT;
  out_closing_date := make_date(v_year, v_month, LEAST(v_closing_day, v_closing_last_day));

  IF v_due_day >= v_closing_day THEN
    v_due_month_first := v_closing_month_first;
  ELSE
    v_due_month_first := (v_closing_month_first + INTERVAL '1 month')::DATE;
  END IF;
  v_due_last_day := EXTRACT(DAY FROM (v_due_month_first + INTERVAL '1 month - 1 day')::DATE)::INT;
  out_due_date := make_date(
    EXTRACT(YEAR FROM v_due_month_first)::INT,
    EXTRACT(MONTH FROM v_due_month_first)::INT,
    LEAST(v_due_day, v_due_last_day)
  );

  out_period_year := v_year::SMALLINT;
  out_period_month := v_month::SMALLINT;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Extensao da tabela cash_flow_transactions (idempotente)
ALTER TABLE public.cash_flow_transactions
  ADD COLUMN IF NOT EXISTS due_date             DATE,
  ADD COLUMN IF NOT EXISTS paid_date            DATE,
  ADD COLUMN IF NOT EXISTS status               TEXT NOT NULL DEFAULT 'em_aberto',
  ADD COLUMN IF NOT EXISTS payment_method       TEXT,
  ADD COLUMN IF NOT EXISTS classification       TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_type      TEXT,
  ADD COLUMN IF NOT EXISTS credit_card_id       UUID,
  ADD COLUMN IF NOT EXISTS credit_invoice_id    UUID,
  ADD COLUMN IF NOT EXISTS installment_group_id UUID,
  ADD COLUMN IF NOT EXISTS installment_number   SMALLINT,
  ADD COLUMN IF NOT EXISTS installment_total    SMALLINT;

-- CHECK constraints (criados apenas se ainda nao existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cft_status_check'
  ) THEN
    ALTER TABLE public.cash_flow_transactions
      ADD CONSTRAINT cft_status_check
      CHECK (status IN ('em_aberto', 'baixado', 'parcial', 'atrasado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cft_payment_method_check'
  ) THEN
    ALTER TABLE public.cash_flow_transactions
      ADD CONSTRAINT cft_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN
        ('credit_card','debit','pix','boleto','cash','transfer','outro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cft_classification_check'
  ) THEN
    ALTER TABLE public.cash_flow_transactions
      ADD CONSTRAINT cft_classification_check
      CHECK (classification IS NULL OR classification IN
        ('essencial','poderia_esperar','obrigatoria'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cft_recurrence_type_check'
  ) THEN
    ALTER TABLE public.cash_flow_transactions
      ADD CONSTRAINT cft_recurrence_type_check
      CHECK (recurrence_type IS NULL OR recurrence_type IN ('fixa','variavel'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cft_credit_card_fk'
  ) THEN
    ALTER TABLE public.cash_flow_transactions
      ADD CONSTRAINT cft_credit_card_fk
      FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cft_credit_invoice_fk'
  ) THEN
    ALTER TABLE public.cash_flow_transactions
      ADD CONSTRAINT cft_credit_invoice_fk
      FOREIGN KEY (credit_invoice_id) REFERENCES public.credit_card_invoices(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_invoices_payment_tx_fk'
  ) THEN
    ALTER TABLE public.credit_card_invoices
      ADD CONSTRAINT credit_invoices_payment_tx_fk
      FOREIGN KEY (payment_transaction_id) REFERENCES public.cash_flow_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cft_due_date     ON public.cash_flow_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_cft_status       ON public.cash_flow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_cft_card         ON public.cash_flow_transactions(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_cft_invoice      ON public.cash_flow_transactions(credit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cft_inst_group   ON public.cash_flow_transactions(installment_group_id);
CREATE INDEX IF NOT EXISTS idx_cft_payment_method ON public.cash_flow_transactions(payment_method);

-- 5. Backfill: popula due_date / paid_date / status para registros existentes
UPDATE public.cash_flow_transactions
   SET due_date  = COALESCE(due_date,  date::date),
       paid_date = COALESCE(paid_date, CASE WHEN income > 0 OR expense > 0 THEN date::date END),
       status    = CASE
         WHEN income >= value OR expense >= value THEN 'baixado'
         WHEN income > 0 OR expense > 0           THEN 'parcial'
         ELSE 'em_aberto'
       END
 WHERE due_date IS NULL OR status = 'em_aberto';

-- 6. Trigger BEFORE: vincula fatura automaticamente quando payment_method='credit_card'
CREATE OR REPLACE FUNCTION public.cft_auto_link_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_meta RECORD;
  v_invoice_id UUID;
  v_ref_date DATE;
BEGIN
  -- Garante due_date sempre preenchido (mesmo para registros sem cartao)
  IF NEW.due_date IS NULL THEN
    NEW.due_date := NEW.date::DATE;
  END IF;

  -- Apenas para lancamentos com cartao
  IF NEW.payment_method = 'credit_card' AND NEW.credit_card_id IS NOT NULL THEN
    v_ref_date := COALESCE(NEW.due_date, NEW.date::DATE);

    SELECT * INTO v_meta
      FROM public.compute_invoice_for_card(NEW.credit_card_id, v_ref_date);

    INSERT INTO public.credit_card_invoices
      (credit_card_id, period_year, period_month, closing_date, due_date)
    VALUES (NEW.credit_card_id, v_meta.out_period_year, v_meta.out_period_month,
            v_meta.out_closing_date, v_meta.out_due_date)
    ON CONFLICT (credit_card_id, period_year, period_month) DO NOTHING;

    SELECT id INTO v_invoice_id
      FROM public.credit_card_invoices
     WHERE credit_card_id = NEW.credit_card_id
       AND period_year = v_meta.out_period_year
       AND period_month = v_meta.out_period_month;

    NEW.credit_invoice_id := v_invoice_id;
    -- Para lancamentos de cartao alinhamos due_date com o vencimento da fatura
    NEW.due_date := v_meta.out_due_date;
  END IF;

  -- Se paid_date foi preenchido, ja marca como baixado
  IF NEW.paid_date IS NOT NULL AND (NEW.status IS NULL OR NEW.status = 'em_aberto') THEN
    NEW.status := 'baixado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cft_auto_link_invoice_trg ON public.cash_flow_transactions;
CREATE TRIGGER cft_auto_link_invoice_trg
  BEFORE INSERT OR UPDATE ON public.cash_flow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.cft_auto_link_invoice();

-- 7. Trigger AFTER: mantem credit_card_invoices.total_value sincronizado
CREATE OR REPLACE FUNCTION public.invoice_total_recalc()
RETURNS TRIGGER AS $$
DECLARE
  v_new_inv UUID;
  v_old_inv UUID;
BEGIN
  v_new_inv := CASE WHEN TG_OP <> 'DELETE' THEN NEW.credit_invoice_id END;
  v_old_inv := CASE WHEN TG_OP <> 'INSERT' THEN OLD.credit_invoice_id END;

  IF v_new_inv IS NOT NULL THEN
    UPDATE public.credit_card_invoices
       SET total_value = (
         SELECT COALESCE(SUM(value), 0)
           FROM public.cash_flow_transactions
          WHERE credit_invoice_id = v_new_inv
       )
     WHERE id = v_new_inv;
  END IF;

  IF v_old_inv IS NOT NULL AND v_old_inv IS DISTINCT FROM v_new_inv THEN
    UPDATE public.credit_card_invoices
       SET total_value = (
         SELECT COALESCE(SUM(value), 0)
           FROM public.cash_flow_transactions
          WHERE credit_invoice_id = v_old_inv
       )
     WHERE id = v_old_inv;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_total_recalc_trg ON public.cash_flow_transactions;
CREATE TRIGGER invoice_total_recalc_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_flow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.invoice_total_recalc();
