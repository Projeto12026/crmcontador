-- Integração GClick -> WhatsApp (INSS/FGTS)

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS envia_via_gclick boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.gclick_guide_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_document text NOT NULL,
  guide_type text NOT NULL CHECK (guide_type IN ('INSS', 'FGTS')),
  competencia_mes integer NOT NULL CHECK (competencia_mes >= 1 AND competencia_mes <= 12),
  competencia_ano integer NOT NULL CHECK (competencia_ano >= 2000),
  task_id text,
  atividade_id text,
  arquivo_nome text,
  arquivo_url text NOT NULL,
  status text NOT NULL DEFAULT 'FOUND' CHECK (status IN ('FOUND', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED')),
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gclick_guide_jobs_dedup
ON public.gclick_guide_jobs (client_id, guide_type, competencia_mes, competencia_ano, arquivo_url);

CREATE INDEX IF NOT EXISTS idx_gclick_guide_jobs_status
ON public.gclick_guide_jobs (status, competencia_ano, competencia_mes);

CREATE TABLE IF NOT EXISTS public.gclick_sync_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  run_mode text NOT NULL DEFAULT 'sync_only' CHECK (run_mode IN ('sync_only', 'sync_and_send')),
  interval_minutes integer NOT NULL DEFAULT 5 CHECK (interval_minutes >= 5),
  competencia_mes integer CHECK (competencia_mes >= 1 AND competencia_mes <= 12),
  competencia_ano integer CHECK (competencia_ano >= 2000),
  match_patterns jsonb NOT NULL DEFAULT jsonb_build_object(
    'INSS', jsonb_build_array('inss', 'gps', 'previdencia'),
    'FGTS', jsonb_build_array('fgts', 'sefip', 'grf')
  ),
  last_run_at timestamptz,
  last_run_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gclick_sync_config_singleton
ON public.gclick_sync_config ((true));

ALTER TABLE public.gclick_guide_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gclick_sync_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users full access" ON public.gclick_guide_jobs;
CREATE POLICY "Authenticated users full access"
ON public.gclick_guide_jobs
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users full access" ON public.gclick_sync_config;
CREATE POLICY "Authenticated users full access"
ON public.gclick_sync_config
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS update_gclick_guide_jobs_updated_at ON public.gclick_guide_jobs;
CREATE TRIGGER update_gclick_guide_jobs_updated_at
BEFORE UPDATE ON public.gclick_guide_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gclick_sync_config_updated_at ON public.gclick_sync_config;
CREATE TRIGGER update_gclick_sync_config_updated_at
BEFORE UPDATE ON public.gclick_sync_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
