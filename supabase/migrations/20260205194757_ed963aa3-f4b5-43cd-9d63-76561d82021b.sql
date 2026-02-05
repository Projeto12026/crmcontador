-- Add client_name field for free-form client names (when not linked to a client)
ALTER TABLE public.contracts ADD COLUMN client_name text;