
-- Empresas Cora (cadastro de boletos, espelhando contratos)
CREATE TABLE public.cora_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id),
  client_name text,
  cnpj text NOT NULL,
  telefone text,
  email text,
  dia_vencimento integer DEFAULT 15,
  valor_mensal numeric DEFAULT 0,
  forma_envio text DEFAULT 'EMAIL',
  observacoes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cora_empresas_cnpj ON public.cora_empresas(cnpj);

-- Cache de boletos sincronizados da Cora
CREATE TABLE public.cora_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cora_invoice_id text NOT NULL UNIQUE,
  empresa_id uuid REFERENCES public.cora_empresas(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  total_amount_cents bigint DEFAULT 0,
  due_date date,
  paid_at timestamptz,
  competencia_mes integer,
  competencia_ano integer,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cora_boletos_cnpj ON public.cora_boletos(cnpj);
CREATE INDEX idx_cora_boletos_empresa ON public.cora_boletos(empresa_id);
CREATE INDEX idx_cora_boletos_competencia ON public.cora_boletos(competencia_ano, competencia_mes);
CREATE INDEX idx_cora_boletos_status ON public.cora_boletos(status);

-- Log de envios
CREATE TABLE public.cora_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.cora_empresas(id) ON DELETE CASCADE,
  boleto_id uuid REFERENCES public.cora_boletos(id) ON DELETE SET NULL,
  competencia_mes integer,
  competencia_ano integer,
  canal text,
  sucesso boolean DEFAULT false,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Configurações Cora (token cache, URLs, etc)
CREATE TABLE public.cora_config (
  chave text PRIMARY KEY,
  valor jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cora_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cora_boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cora_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cora_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users full access" ON public.cora_empresas FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON public.cora_boletos FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON public.cora_envios FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON public.cora_config FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger updated_at for cora_empresas
CREATE TRIGGER update_cora_empresas_updated_at
  BEFORE UPDATE ON public.cora_empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
