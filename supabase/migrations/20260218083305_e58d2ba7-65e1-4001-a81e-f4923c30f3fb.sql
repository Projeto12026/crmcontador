-- Add source field to distinguish between Financeiro and Nescon transactions
ALTER TABLE public.cash_flow_transactions 
ADD COLUMN source text NOT NULL DEFAULT 'financeiro';

-- Create index for filtering by source
CREATE INDEX idx_cash_flow_transactions_source ON public.cash_flow_transactions(source);