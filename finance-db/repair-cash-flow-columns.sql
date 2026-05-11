-- Reparo rápido: "Could not find the 'paid_date' column of 'cash_flow_transactions'"
-- quando a tabela foi criada antes de paid_date/due_date/status existirem.
-- Rode contra o banco financeiro (psql, Adminer, painel). Depois recarregue o schema do PostgREST
-- (reiniciar o container do PostgREST ou, como superuser: NOTIFY pgrst, 'reload schema';).

ALTER TABLE public.cash_flow_transactions
  ADD COLUMN IF NOT EXISTS source               TEXT DEFAULT 'financeiro',
  ADD COLUMN IF NOT EXISTS due_date             DATE,
  ADD COLUMN IF NOT EXISTS paid_date            DATE,
  ADD COLUMN IF NOT EXISTS status               TEXT DEFAULT 'em_aberto',
  ADD COLUMN IF NOT EXISTS payment_method       TEXT,
  ADD COLUMN IF NOT EXISTS classification       TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_type      TEXT,
  ADD COLUMN IF NOT EXISTS credit_card_id       UUID,
  ADD COLUMN IF NOT EXISTS credit_invoice_id    UUID,
  ADD COLUMN IF NOT EXISTS installment_group_id UUID,
  ADD COLUMN IF NOT EXISTS installment_number   SMALLINT,
  ADD COLUMN IF NOT EXISTS installment_total    SMALLINT;

UPDATE public.cash_flow_transactions
   SET source = COALESCE(source, 'financeiro')
 WHERE source IS NULL;

UPDATE public.cash_flow_transactions
   SET status = COALESCE(NULLIF(TRIM(status), ''), 'em_aberto')
 WHERE status IS NULL;
