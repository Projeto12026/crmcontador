-- Add client_status enum and update clients table
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'blocked');

-- Add status column to clients (default to active, migrate existing is_active)
ALTER TABLE public.clients ADD COLUMN status public.client_status NOT NULL DEFAULT 'active';

-- Migrate existing is_active data
UPDATE public.clients SET status = CASE WHEN is_active = true THEN 'active'::client_status ELSE 'inactive'::client_status END;