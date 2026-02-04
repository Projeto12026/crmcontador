-- Drop existing tables (sistema de boletos será substituído)
DROP TABLE IF EXISTS public.message_templates CASCADE;
DROP TABLE IF EXISTS public.whatsapp_config CASCADE;
DROP TABLE IF EXISTS public.sync_log CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS public.empresa_status CASCADE;
DROP TYPE IF EXISTS public.forma_envio CASCADE;

-- ============================================
-- ENUMS
-- ============================================

-- Status de tarefas
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Prioridade
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- Status comercial (funil)
CREATE TYPE public.lead_status AS ENUM ('prospecting', 'contact', 'proposal', 'negotiation', 'won', 'lost');

-- Status de processo
CREATE TYPE public.process_status AS ENUM ('pending', 'in_progress', 'awaiting_docs', 'awaiting_client', 'completed', 'cancelled');

-- Status de contrato
CREATE TYPE public.contract_status AS ENUM ('draft', 'active', 'suspended', 'cancelled', 'expired');

-- Status de onboarding
CREATE TYPE public.onboarding_status AS ENUM ('pending', 'in_progress', 'completed');

-- Status financeiro
CREATE TYPE public.financial_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

-- Tipo de transação
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- ============================================
-- TABELAS PRINCIPAIS
-- ============================================

-- Clientes (central do CRM)
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trading_name TEXT, -- nome fantasia
    document TEXT, -- CPF ou CNPJ
    document_type TEXT DEFAULT 'CNPJ', -- CPF ou CNPJ
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Contatos de clientes
CREATE TABLE public.client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    role TEXT, -- cargo
    email TEXT,
    phone TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- MÓDULO: TAREFAS
-- ============================================

CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    status public.task_status DEFAULT 'pending' NOT NULL,
    priority public.priority_level DEFAULT 'medium' NOT NULL,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- MÓDULO: COMERCIAL
-- ============================================

CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT, -- origem (indicação, site, etc)
    status public.lead_status DEFAULT 'prospecting' NOT NULL,
    expected_value NUMERIC(12,2),
    notes TEXT,
    converted_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Atividades comerciais (histórico de interações)
CREATE TABLE public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    activity_type TEXT NOT NULL, -- call, email, meeting, proposal
    description TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- MÓDULO: PROCESSOS (Legalização)
-- ============================================

-- Templates de processos
CREATE TABLE public.process_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Etapas do template
CREATE TABLE public.process_template_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.process_templates(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    estimated_days INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Processos em andamento
CREATE TABLE public.processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.process_templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status public.process_status DEFAULT 'pending' NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Etapas do processo
CREATE TABLE public.process_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID REFERENCES public.processes(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    status public.process_status DEFAULT 'pending' NOT NULL,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- MÓDULO: CONTRATOS
-- ============================================

CREATE TABLE public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status public.contract_status DEFAULT 'draft' NOT NULL,
    monthly_value NUMERIC(12,2),
    start_date DATE,
    end_date DATE,
    billing_day INTEGER DEFAULT 10, -- dia do vencimento
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Serviços do contrato
CREATE TABLE public.contract_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
    service_name TEXT NOT NULL,
    description TEXT,
    value NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- MÓDULO: ONBOARDING
-- ============================================

-- Templates de onboarding
CREATE TABLE public.onboarding_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Itens do template
CREATE TABLE public.onboarding_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.onboarding_templates(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Onboarding do cliente
CREATE TABLE public.client_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
    status public.onboarding_status DEFAULT 'pending' NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Itens do onboarding
CREATE TABLE public.client_onboarding_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onboarding_id UUID REFERENCES public.client_onboarding(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- MÓDULO: FINANCEIRO
-- ============================================

-- Categorias financeiras
CREATE TABLE public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type public.transaction_type NOT NULL,
    color TEXT DEFAULT '#6366f1',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Transações financeiras
CREATE TABLE public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
    type public.transaction_type NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status public.financial_status DEFAULT 'pending' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- CONFIGURAÇÕES DO SISTEMA
-- ============================================

CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- RLS POLICIES (sistema de uso pessoal - acesso total)
-- ============================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso total (uso pessoal)
CREATE POLICY "Allow all access" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.lead_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.process_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.process_template_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.processes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.process_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.contract_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.onboarding_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.onboarding_template_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_onboarding FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_onboarding_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.financial_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.financial_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGERS PARA updated_at
-- ============================================

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_process_templates_updated_at BEFORE UPDATE ON public.process_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_process_steps_updated_at BEFORE UPDATE ON public.process_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_onboarding_templates_updated_at BEFORE UPDATE ON public.onboarding_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_onboarding_updated_at BEFORE UPDATE ON public.client_onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_onboarding_items_updated_at BEFORE UPDATE ON public.client_onboarding_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Categorias financeiras padrão
INSERT INTO public.financial_categories (name, type, color) VALUES
('Honorários', 'income', '#22c55e'),
('Consultoria', 'income', '#3b82f6'),
('Serviços Extras', 'income', '#8b5cf6'),
('Aluguel', 'expense', '#ef4444'),
('Software', 'expense', '#f59e0b'),
('Material de Escritório', 'expense', '#6b7280');

-- Template de processo padrão: Abertura de Empresa
INSERT INTO public.process_templates (id, name, description) VALUES 
('00000000-0000-0000-0000-000000000001', 'Abertura de Empresa', 'Processo completo de abertura de empresa');

INSERT INTO public.process_template_steps (template_id, name, order_index, estimated_days) VALUES
('00000000-0000-0000-0000-000000000001', 'Consulta de Viabilidade', 1, 3),
('00000000-0000-0000-0000-000000000001', 'Elaboração do Contrato Social', 2, 2),
('00000000-0000-0000-0000-000000000001', 'Registro na Junta Comercial', 3, 5),
('00000000-0000-0000-0000-000000000001', 'Obtenção do CNPJ', 4, 2),
('00000000-0000-0000-0000-000000000001', 'Inscrição Estadual', 5, 3),
('00000000-0000-0000-0000-000000000001', 'Inscrição Municipal', 6, 3),
('00000000-0000-0000-0000-000000000001', 'Alvará de Funcionamento', 7, 5);

-- Template de onboarding padrão
INSERT INTO public.onboarding_templates (id, name, description) VALUES
('00000000-0000-0000-0000-000000000002', 'Onboarding Padrão', 'Checklist de integração de novos clientes');

INSERT INTO public.onboarding_template_items (template_id, title, order_index) VALUES
('00000000-0000-0000-0000-000000000002', 'Coletar documentos pessoais', 1),
('00000000-0000-0000-0000-000000000002', 'Coletar documentos da empresa', 2),
('00000000-0000-0000-0000-000000000002', 'Configurar acesso ao sistema contábil', 3),
('00000000-0000-0000-0000-000000000002', 'Configurar certificado digital', 4),
('00000000-0000-0000-0000-000000000002', 'Reunião de alinhamento', 5),
('00000000-0000-0000-0000-000000000002', 'Treinamento do cliente', 6);