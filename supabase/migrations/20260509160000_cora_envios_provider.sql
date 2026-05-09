-- Provedor WhatsApp utilizado em cada envio (wascript | lion_crm) e flag de failover.
-- provider_text/provider_pdf detalham, quando aplicável, o provedor do PDF e o do texto
-- (em alguns fluxos os dois podem divergir caso o failover atue só em uma das partes).

ALTER TABLE public.cora_envios
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_pdf TEXT,
  ADD COLUMN IF NOT EXISTS provider_text TEXT,
  ADD COLUMN IF NOT EXISTS failover BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cora_envios_provider
  ON public.cora_envios(provider)
  WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cora_envios_created_at
  ON public.cora_envios(created_at DESC);

COMMENT ON COLUMN public.cora_envios.provider IS 'Provedor WhatsApp efetivamente usado: wascript | lion_crm';
COMMENT ON COLUMN public.cora_envios.provider_pdf IS 'Provedor que entregou o PDF (quando o envio teve PDF)';
COMMENT ON COLUMN public.cora_envios.provider_text IS 'Provedor que entregou a mensagem de texto (quando o envio teve texto)';
COMMENT ON COLUMN public.cora_envios.failover IS 'TRUE quando o provedor primário falhou e o secundário foi acionado';
