-- Atualizar enum de status com novos valores
ALTER TYPE public.empresa_status ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE public.empresa_status ADD VALUE IF NOT EXISTS 'LATE';
ALTER TYPE public.empresa_status ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE public.empresa_status ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE public.empresa_status ADD VALUE IF NOT EXISTS 'ERRO_CONSULTA';

-- Atualizar enum de forma de envio
ALTER TYPE public.forma_envio ADD VALUE IF NOT EXISTS 'NELSON';