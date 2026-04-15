-- Excluir cliente remove empresas Cora vinculadas; boletos/envios cascateiam das empresas.
ALTER TABLE public.cora_empresas
  DROP CONSTRAINT IF EXISTS cora_empresas_client_id_fkey;

ALTER TABLE public.cora_empresas
  ADD CONSTRAINT cora_empresas_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
