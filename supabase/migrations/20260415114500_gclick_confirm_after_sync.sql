ALTER TABLE public.gclick_sync_config
ADD COLUMN IF NOT EXISTS ask_send_confirmation_on_sync boolean NOT NULL DEFAULT false;
