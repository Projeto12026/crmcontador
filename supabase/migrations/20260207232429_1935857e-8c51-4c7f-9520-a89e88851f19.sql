
-- Catálogo de serviços contábeis por departamento
CREATE TABLE public.pricing_service_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'contabil',
  description TEXT,
  default_hours_per_month NUMERIC NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON public.pricing_service_catalog
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Propostas de honorários
CREATE TABLE public.pricing_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  tax_regime TEXT,
  num_employees INTEGER DEFAULT 0,
  num_monthly_invoices INTEGER DEFAULT 0,
  monthly_revenue NUMERIC DEFAULT 0,
  hourly_cost NUMERIC NOT NULL DEFAULT 0,
  markup_percentage NUMERIC NOT NULL DEFAULT 0,
  total_monthly_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON public.pricing_proposals
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Itens da proposta
CREATE TABLE public.pricing_proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  service_catalog_id UUID REFERENCES public.pricing_service_catalog(id),
  service_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'contabil',
  hours_per_month NUMERIC NOT NULL DEFAULT 1,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON public.pricing_proposal_items
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_pricing_service_catalog_updated_at
  BEFORE UPDATE ON public.pricing_service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_proposals_updated_at
  BEFORE UPDATE ON public.pricing_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir catálogo padrão de serviços contábeis
INSERT INTO public.pricing_service_catalog (name, department, description, default_hours_per_month) VALUES
-- Departamento Contábil
('Escrituração Contábil', 'contabil', 'Lançamentos contábeis mensais, conciliações e classificações', 4),
('Balancete Mensal', 'contabil', 'Elaboração e análise do balancete mensal', 2),
('Balanço Patrimonial', 'contabil', 'Elaboração do balanço patrimonial anual', 1),
('DRE', 'contabil', 'Demonstração do Resultado do Exercício', 1),
('LALUR/LACS', 'contabil', 'Livro de Apuração do Lucro Real', 2),
('ECD - SPED Contábil', 'contabil', 'Escrituração Contábil Digital', 2),
('ECF', 'contabil', 'Escrituração Contábil Fiscal', 3),

-- Departamento Fiscal
('Escrituração Fiscal', 'fiscal', 'Lançamento de notas fiscais de entrada e saída', 4),
('Apuração de ICMS', 'fiscal', 'Cálculo e apuração mensal do ICMS', 2),
('Apuração de ISS', 'fiscal', 'Cálculo e apuração mensal do ISS', 1),
('Apuração PIS/COFINS', 'fiscal', 'Cálculo e apuração de PIS e COFINS', 2),
('SPED Fiscal (ICMS/IPI)', 'fiscal', 'Geração e envio do SPED Fiscal', 2),
('EFD Contribuições', 'fiscal', 'Geração e envio da EFD Contribuições', 2),
('DCTF/DCTFWeb', 'fiscal', 'Declaração de Débitos e Créditos Tributários', 1),
('DIRF', 'fiscal', 'Declaração do Imposto de Renda Retido na Fonte', 1),
('Simples Nacional - DAS', 'fiscal', 'Cálculo e emissão do DAS mensal', 1),

-- Departamento Pessoal
('Folha de Pagamento', 'pessoal', 'Processamento da folha de pagamento mensal', 3),
('Admissão de Funcionários', 'pessoal', 'Processo completo de admissão', 1),
('Rescisão de Funcionários', 'pessoal', 'Processo completo de rescisão', 1),
('Férias', 'pessoal', 'Cálculo e processamento de férias', 1),
('13º Salário', 'pessoal', 'Cálculo e processamento do 13º', 1),
('eSocial', 'pessoal', 'Envio de eventos ao eSocial', 2),
('CAGED/RAIS', 'pessoal', 'Declarações trabalhistas obrigatórias', 1),
('GFIP/SEFIP', 'pessoal', 'Guia de Recolhimento do FGTS', 1),

-- Departamento Societário/Legalização
('Abertura de Empresa', 'societario', 'Processo completo de abertura', 8),
('Alteração Contratual', 'societario', 'Elaboração e registro de alterações', 4),
('Encerramento de Empresa', 'societario', 'Processo completo de encerramento', 12),
('Certidões e Documentos', 'societario', 'Emissão de certidões negativas e documentos', 1),

-- Consultoria
('Planejamento Tributário', 'consultoria', 'Análise e planejamento para redução tributária', 4),
('Consultoria Gerencial', 'consultoria', 'Reuniões e orientações gerenciais', 2),
('BPO Financeiro', 'consultoria', 'Terceirização do financeiro', 8);
