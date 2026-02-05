-- Add manager and tax_type columns to contracts table
ALTER TABLE public.contracts 
ADD COLUMN manager TEXT CHECK (manager IN ('nescon', 'jean')),
ADD COLUMN tax_type TEXT CHECK (tax_type IN ('simples', 'lp', 'mei'));

-- Create index for faster filtering
CREATE INDEX idx_contracts_manager ON public.contracts(manager);
CREATE INDEX idx_contracts_tax_type ON public.contracts(tax_type);