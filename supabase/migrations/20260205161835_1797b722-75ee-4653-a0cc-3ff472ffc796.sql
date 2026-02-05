-- Remover o valor 'CORA' do enum forma_envio
-- Primeiro, verificamos se existem registros usando 'CORA' e atualizamos para 'EMAIL'
UPDATE public.financial_transactions 
SET notes = COALESCE(notes, '') || ' (migrado de CORA para EMAIL)'
WHERE notes LIKE '%CORA%';

-- Criar novo enum sem CORA
CREATE TYPE public.forma_envio_new AS ENUM ('EMAIL', 'WHATSAPP');

-- Dropar o enum antigo (se não estiver sendo usado por nenhuma coluna)
DROP TYPE IF EXISTS public.forma_envio;

-- Renomear o novo enum
ALTER TYPE public.forma_envio_new RENAME TO forma_envio;