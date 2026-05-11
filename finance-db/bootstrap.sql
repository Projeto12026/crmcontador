-- =====================================================================
-- BOOTSTRAP DO BANCO FINANCEIRO LOCAL (Postgres self-hosted)
-- =====================================================================
-- Aplicar UMA VEZ num banco vazio do Postgres no EasyPanel.
-- Idempotente: pode reexecutar sem quebrar.
--
-- Cria toda a estrutura do modulo financeiro:
--   - account_categories (Plano de Contas)
--   - financial_accounts (Banco/Caixa/Cartao)
--   - cash_flow_transactions (Lancamentos do Fluxo de Caixa)
--   - financial_categories + financial_transactions (legacy)
--   - credit_cards + credit_card_invoices (Cartao + Faturas)
--   - Funcao compute_invoice_for_card
--   - Triggers cft_auto_link_invoice e invoice_total_recalc
--
-- + roles 'anon' / 'authenticated' / 'authenticator' para PostgREST.
-- =====================================================================

-- 0. Extensoes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Helper para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. ENUMs basicos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_account_type') THEN
    CREATE TYPE public.financial_account_type AS ENUM ('bank', 'cash', 'credit');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_status') THEN
    CREATE TYPE public.financial_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM ('aberta', 'fechada', 'paga', 'atrasada');
  END IF;
END $$;

-- 3. account_categories (Plano de Contas hierarquico)
CREATE TABLE IF NOT EXISTS public.account_categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  group_number INTEGER NOT NULL CHECK (group_number BETWEEN 1 AND 300),
  parent_id    TEXT REFERENCES public.account_categories(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_account_categories_updated_at ON public.account_categories;
CREATE TRIGGER update_account_categories_updated_at
  BEFORE UPDATE ON public.account_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_account_categories_group  ON public.account_categories(group_number);
CREATE INDEX IF NOT EXISTS idx_account_categories_parent ON public.account_categories(parent_id);

-- 4. financial_accounts
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  type                public.financial_account_type NOT NULL,
  initial_balance     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  current_balance     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  account_category_id TEXT UNIQUE REFERENCES public.account_categories(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_financial_accounts_updated_at ON public.financial_accounts;
CREATE TRIGGER update_financial_accounts_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON public.financial_accounts(type);

-- 5. credit_cards (1:1 com financial_accounts type=credit)
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_account_id UUID NOT NULL UNIQUE
    REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  brand                TEXT,
  credit_limit         NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_day          SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day              SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color                TEXT,
  icon                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_credit_cards_updated_at ON public.credit_cards;
CREATE TRIGGER update_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_credit_cards_account ON public.credit_cards(financial_account_id);

-- Trigger valida que financial_account.type = 'credit'
CREATE OR REPLACE FUNCTION public.credit_cards_validate_account()
RETURNS TRIGGER AS $$
DECLARE v_type TEXT;
BEGIN
  SELECT type::TEXT INTO v_type
    FROM public.financial_accounts WHERE id = NEW.financial_account_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'financial_account % nao encontrada', NEW.financial_account_id;
  END IF;
  IF v_type <> 'credit' THEN
    RAISE EXCEPTION 'financial_account % nao e do tipo credit (atual: %)', NEW.financial_account_id, v_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credit_cards_validate_account_trg ON public.credit_cards;
CREATE TRIGGER credit_cards_validate_account_trg
  BEFORE INSERT OR UPDATE OF financial_account_id ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.credit_cards_validate_account();

-- 6. credit_card_invoices
CREATE TABLE IF NOT EXISTS public.credit_card_invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id         UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  period_year            SMALLINT NOT NULL,
  period_month           SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  closing_date           DATE NOT NULL,
  due_date               DATE NOT NULL,
  total_value            NUMERIC(18,2) NOT NULL DEFAULT 0,
  status                 public.invoice_status NOT NULL DEFAULT 'aberta',
  paid_date              DATE,
  payment_transaction_id UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credit_card_id, period_year, period_month)
);

DROP TRIGGER IF EXISTS update_credit_card_invoices_updated_at ON public.credit_card_invoices;
CREATE TRIGGER update_credit_card_invoices_updated_at
  BEFORE UPDATE ON public.credit_card_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_credit_invoices_card   ON public.credit_card_invoices(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_period ON public.credit_card_invoices(credit_card_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_due    ON public.credit_card_invoices(due_date);

-- 7. cash_flow_transactions (com TODAS as colunas atuais + extensoes)
-- Aqui clients/contracts NAO sao FK (vivem no Supabase). Guardamos so o UUID.
CREATE TABLE IF NOT EXISTS public.cash_flow_transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 TIMESTAMPTZ NOT NULL,
  account_id           TEXT NOT NULL REFERENCES public.account_categories(id) ON DELETE RESTRICT,
  description          TEXT NOT NULL,

  -- Valores futuros (projetados)
  future_income        NUMERIC(18, 2) DEFAULT 0,
  future_expense       NUMERIC(18, 2) DEFAULT 0,

  -- Valores realizados
  income               NUMERIC(18, 2) DEFAULT 0,
  expense              NUMERIC(18, 2) DEFAULT 0,

  -- Valor de referencia
  value                NUMERIC(18, 2) NOT NULL,

  origin_destination   TEXT NOT NULL,
  financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  type                 public.transaction_type NOT NULL,
  paid_by_company      BOOLEAN NOT NULL DEFAULT false,

  -- IDs externos (vivem no Supabase, sem FK aqui)
  client_id            UUID,
  contract_id          UUID,

  notes                TEXT,
  source               TEXT NOT NULL DEFAULT 'financeiro',

  -- Vencimento / baixa
  due_date             DATE,
  paid_date            DATE,
  status               TEXT NOT NULL DEFAULT 'em_aberto'
    CHECK (status IN ('em_aberto', 'baixado', 'parcial', 'atrasado')),

  -- Forma de pagamento / classificacao / recorrencia
  payment_method       TEXT
    CHECK (payment_method IS NULL OR payment_method IN
      ('credit_card','debit','pix','boleto','cash','transfer','outro')),
  classification       TEXT
    CHECK (classification IS NULL OR classification IN
      ('essencial','poderia_esperar','obrigatoria')),
  recurrence_type      TEXT
    CHECK (recurrence_type IS NULL OR recurrence_type IN ('fixa','variavel')),

  -- Cartao
  credit_card_id       UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  credit_invoice_id    UUID REFERENCES public.credit_card_invoices(id) ON DELETE SET NULL,

  -- Parcelas
  installment_group_id UUID,
  installment_number   SMALLINT,
  installment_total    SMALLINT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT at_least_one_value CHECK (
    COALESCE(future_income, 0) > 0 OR
    COALESCE(future_expense, 0) > 0 OR
    COALESCE(income, 0) > 0 OR
    COALESCE(expense, 0) > 0
  )
);

-- FK reversa: credit_card_invoices.payment_transaction_id -> cash_flow_transactions.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_invoices_payment_tx_fk'
  ) THEN
    ALTER TABLE public.credit_card_invoices
      ADD CONSTRAINT credit_invoices_payment_tx_fk
      FOREIGN KEY (payment_transaction_id)
      REFERENCES public.cash_flow_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_cash_flow_transactions_updated_at ON public.cash_flow_transactions;
CREATE TRIGGER update_cash_flow_transactions_updated_at
  BEFORE UPDATE ON public.cash_flow_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cft_date              ON public.cash_flow_transactions(date);
CREATE INDEX IF NOT EXISTS idx_cft_account           ON public.cash_flow_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_cft_fin_account       ON public.cash_flow_transactions(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_cft_due_date          ON public.cash_flow_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_cft_status            ON public.cash_flow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_cft_card              ON public.cash_flow_transactions(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_cft_invoice           ON public.cash_flow_transactions(credit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cft_inst_group        ON public.cash_flow_transactions(installment_group_id);
CREATE INDEX IF NOT EXISTS idx_cft_payment_method    ON public.cash_flow_transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_cft_source            ON public.cash_flow_transactions(source);

-- 8. financial_categories (legacy)
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       public.transaction_type NOT NULL,
  color      TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. financial_transactions (legacy)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID,
  contract_id  UUID,
  category_id  UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  type         public.transaction_type NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(18, 2) NOT NULL,
  due_date     DATE NOT NULL,
  paid_date    DATE,
  status       public.financial_status NOT NULL DEFAULT 'pending',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_financial_transactions_updated_at ON public.financial_transactions;
CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ft_due_date  ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_ft_status    ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ft_paid_date ON public.financial_transactions(paid_date);

-- 10. Funcao para calcular fatura de uma compra (mesma logica do Supabase)
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

-- 11. Trigger BEFORE: vincula fatura ao lancamento se for cartao
CREATE OR REPLACE FUNCTION public.cft_auto_link_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_meta RECORD;
  v_invoice_id UUID;
  v_ref_date DATE;
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_date := NEW.date::DATE;
  END IF;

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
    NEW.due_date := v_meta.out_due_date;
  END IF;

  IF NEW.paid_date IS NOT NULL AND (NEW.status IS NULL OR NEW.status = 'em_aberto') THEN
    NEW.status := 'baixado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cft_auto_link_invoice_trg ON public.cash_flow_transactions;
CREATE TRIGGER cft_auto_link_invoice_trg
  BEFORE INSERT OR UPDATE ON public.cash_flow_transactions
  FOR EACH ROW EXECUTE FUNCTION public.cft_auto_link_invoice();

-- 12. Trigger AFTER: recalc total_value da fatura
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
  FOR EACH ROW EXECUTE FUNCTION public.invoice_total_recalc();

-- 13. Roles para PostgREST
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL    ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

-- 14. Seed do Plano de Contas (somente se vazio)
INSERT INTO public.account_categories (id, name, group_number, parent_id) VALUES
  ('1',   'Receitas',                  1, NULL),
  ('1.1', 'Honorarios Contabeis',      1, '1'),
  ('1.2', 'Consultoria',               1, '1'),
  ('1.3', 'Outras Receitas',           1, '1'),
  ('2',   'Dizimos',                   2, NULL),
  ('2.1', 'Dizimo Mensal',             2, '2'),
  ('3',   'Ofertas',                   3, NULL),
  ('3.1', 'Ofertas Especiais',         3, '3'),
  ('4',   'Sonhos',                    4, NULL),
  ('4.1', 'Investimentos',             4, '4'),
  ('4.2', 'Reserva de Emergencia',     4, '4'),
  ('5',   'Despesas Dedutiveis',       5, NULL),
  ('5.1', 'Impostos',                  5, '5'),
  ('5.2', 'Contribuicoes Previdenciarias', 5, '5'),
  ('5.3', 'Taxas e Licencas',          5, '5'),
  ('6',   'Despesas',                  6, NULL),
  ('6.1', 'Despesas Administrativas',  6, '6'),
  ('6.2', 'Salarios e Encargos',       6, '6'),
  ('6.3', 'Aluguel e Condominio',      6, '6'),
  ('6.4', 'Energia e Agua',            6, '6'),
  ('6.5', 'Telefone e Internet',       6, '6'),
  ('6.6', 'Material de Escritorio',    6, '6'),
  ('6.7', 'Software e Sistemas',       6, '6'),
  ('6.8', 'Marketing',                 6, '6'),
  ('6.9', 'Outras Despesas',           6, '6'),
  ('7',   'Banco/Caixa',               7, NULL),
  ('7.1', 'Caixa Geral',               7, '7'),
  ('7.2', 'Banco Principal',           7, '7'),
  ('8',   'Cartoes de Credito',        8, NULL)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- ATENCAO: depois desse bootstrap, o passo seguinte e MIGRAR OS DADOS
-- com o script scripts/migrate-from-supabase.mjs (le do Supabase e
-- copia pra ca). Veja finance-db/README.md.
-- =====================================================================
