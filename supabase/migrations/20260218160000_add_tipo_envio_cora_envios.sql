-- Tipo de envio para deduplicação e regras agendadas (AVISO_5_ANTES, LEMBRETE_DIA, AVISO_2_ATRASO, AVISO_5_ATRASO)
ALTER TABLE public.cora_envios ADD COLUMN IF NOT EXISTS tipo_envio text;

CREATE INDEX IF NOT EXISTS idx_cora_envios_tipo_dedup
  ON public.cora_envios(empresa_id, competencia_mes, competencia_ano, tipo_envio)
  WHERE tipo_envio IS NOT NULL;

COMMENT ON COLUMN public.cora_envios.tipo_envio IS 'Tipo do envio agendado: AVISO_5_ANTES, LEMBRETE_DIA, AVISO_2_ATRASO, AVISO_5_ATRASO';
