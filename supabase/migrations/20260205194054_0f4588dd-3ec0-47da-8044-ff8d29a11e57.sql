-- Make client_id optional in contracts table to allow "free" contracts
ALTER TABLE public.contracts ALTER COLUMN client_id DROP NOT NULL;