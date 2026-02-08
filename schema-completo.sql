-- ============================================================
-- BACKUP COMPLETO DO SCHEMA - CRM Contador
-- Gerado em: 2026-02-08
-- Supabase Project ID: rvekakbpmkemgiwkkdok
-- URL: https://rvekakbpmkemgiwkkdok.supabase.co
-- ============================================================
-- INSTRUÇÕES DE RESTAURAÇÃO:
-- 1. Crie um novo projeto Supabase
-- 2. Acesse o SQL Editor do Supabase
-- 3. Execute este script inteiro
-- 4. Configure os secrets: GCLICK_APP_KEY, GCLICK_APP_SECRET
-- 5. Deploy as Edge Functions manualmente
-- ============================================================

-- ============================================================
-- 1. ENUMS (Tipos Customizados)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM ('draft', 'active', 'suspended', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_account_type AS ENUM ('bank', 'cash', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.forma_envio AS ENUM ('EMAIL', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('prospecting', 'contact', 'proposal', 'negotiation', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.onboarding_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.process_status AS ENUM ('pending', 'in_progress', 'awaiting_docs', 'awaiting_client', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. FUNÇÕES
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. TABELAS
-- ============================================================

-- 3.1 account_categories (hierárquica, IDs textuais tipo plano de contas)
CREATE TABLE IF NOT EXISTS public.account_categories (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  group_number integer NOT NULL,
  parent_id text REFERENCES public.account_categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.2 clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  trading_name text,
  document text,
  document_type text DEFAULT 'CNPJ',
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  notes text,
  status public.client_status NOT NULL DEFAULT 'active',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.3 client_contacts
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.4 contracts
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  client_id uuid REFERENCES public.clients(id),
  client_name text,
  status public.contract_status NOT NULL DEFAULT 'draft',
  monthly_value numeric,
  start_date date,
  end_date date,
  billing_day integer DEFAULT 10,
  tax_type text,
  manager text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.5 contract_services
CREATE TABLE IF NOT EXISTS public.contract_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  service_name text NOT NULL,
  description text,
  value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.6 financial_accounts
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type public.financial_account_type NOT NULL,
  account_category_id text UNIQUE REFERENCES public.account_categories(id),
  initial_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.7 cash_flow_transactions
CREATE TABLE IF NOT EXISTS public.cash_flow_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date timestamptz NOT NULL,
  account_id text NOT NULL REFERENCES public.account_categories(id),
  description text NOT NULL,
  type public.transaction_type NOT NULL,
  value numeric NOT NULL,
  income numeric DEFAULT 0,
  expense numeric DEFAULT 0,
  future_income numeric DEFAULT 0,
  future_expense numeric DEFAULT 0,
  origin_destination text NOT NULL,
  paid_by_company boolean NOT NULL DEFAULT false,
  financial_account_id uuid REFERENCES public.financial_accounts(id),
  client_id uuid REFERENCES public.clients(id),
  contract_id uuid REFERENCES public.contracts(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.8 financial_categories
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type public.transaction_type NOT NULL,
  color text DEFAULT '#6366f1',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.9 financial_transactions
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description text NOT NULL,
  amount numeric NOT NULL,
  type public.transaction_type NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  status public.financial_status NOT NULL DEFAULT 'pending',
  category_id uuid REFERENCES public.financial_categories(id),
  client_id uuid REFERENCES public.clients(id),
  contract_id uuid REFERENCES public.contracts(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.10 leads
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  status public.lead_status NOT NULL DEFAULT 'prospecting',
  source text,
  expected_value numeric,
  notes text,
  lost_reason text,
  converted_client_id uuid REFERENCES public.clients(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.11 lead_activities
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  activity_type text NOT NULL,
  description text NOT NULL,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.12 onboarding_templates
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.13 onboarding_template_items
CREATE TABLE IF NOT EXISTS public.onboarding_template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id),
  title text NOT NULL,
  description text,
  order_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.14 client_onboarding
CREATE TABLE IF NOT EXISTS public.client_onboarding (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  template_id uuid REFERENCES public.onboarding_templates(id),
  status public.onboarding_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.15 client_onboarding_items
CREATE TABLE IF NOT EXISTS public.client_onboarding_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES public.client_onboarding(id),
  title text NOT NULL,
  description text,
  order_index integer NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.16 payroll_obligations
CREATE TABLE IF NOT EXISTS public.payroll_obligations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name text NOT NULL,
  client_cnpj text NOT NULL,
  client_status text NOT NULL DEFAULT 'Ativo',
  client_id uuid REFERENCES public.clients(id),
  competence text NOT NULL,
  obligation_name text NOT NULL DEFAULT 'Folha de pagamento',
  department text NOT NULL DEFAULT 'Departamento Pessoal',
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  completed_at timestamptz,
  notes text,
  gclick_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.17 process_templates
CREATE TABLE IF NOT EXISTS public.process_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.18 process_template_steps
CREATE TABLE IF NOT EXISTS public.process_template_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.process_templates(id),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL,
  estimated_days integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.19 processes
CREATE TABLE IF NOT EXISTS public.processes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  template_id uuid REFERENCES public.process_templates(id),
  title text NOT NULL,
  description text,
  status public.process_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.20 process_steps
CREATE TABLE IF NOT EXISTS public.process_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL,
  status public.process_status NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.21 settings
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.22 tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'pending',
  priority public.priority_level NOT NULL DEFAULT 'medium',
  due_date date,
  client_id uuid REFERENCES public.clients(id),
  is_urgent boolean DEFAULT false,
  is_important boolean DEFAULT false,
  is_focus_list boolean DEFAULT false,
  is_frog boolean DEFAULT false,
  ivy_lee_order integer,
  enabled_views text[] DEFAULT ARRAY['list', 'eisenhower', 'kanban', 'two_lists', 'eat_frog', 'ivy_lee'],
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.23 pricing_service_catalog
CREATE TABLE IF NOT EXISTS public.pricing_service_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  department text NOT NULL DEFAULT 'Contábil',
  service_type text NOT NULL DEFAULT 'recurring',
  default_hours_per_month numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.24 pricing_proposals
CREATE TABLE IF NOT EXISTS public.pricing_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id),
  client_name text,
  status text NOT NULL DEFAULT 'draft',
  hourly_cost numeric NOT NULL DEFAULT 0,
  markup_percentage numeric NOT NULL DEFAULT 0,
  markup_taxes numeric,
  markup_civil_liability numeric,
  markup_pdd numeric,
  markup_interest numeric,
  markup_profit numeric,
  total_monthly_value numeric NOT NULL DEFAULT 0,
  tax_regime text,
  company_type text,
  num_employees integer,
  num_monthly_invoices integer,
  monthly_revenue numeric,
  revenue_bracket text,
  num_branches integer,
  has_digital_certificate boolean,
  fiscal_complexity text,
  complexity_score numeric,
  sellable_hours_month numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.25 pricing_proposal_items
CREATE TABLE IF NOT EXISTS public.pricing_proposal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.pricing_proposals(id),
  service_catalog_id uuid REFERENCES public.pricing_service_catalog(id),
  service_name text NOT NULL,
  service_type text,
  department text NOT NULL DEFAULT 'Contábil',
  hours_per_month numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  department_hourly_cost numeric,
  monthly_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_account_categories_group ON public.account_categories USING btree (group_number);
CREATE INDEX IF NOT EXISTS idx_account_categories_parent ON public.account_categories USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_transactions_account ON public.cash_flow_transactions USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_transactions_date ON public.cash_flow_transactions USING btree (date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_transactions_financial_account ON public.cash_flow_transactions USING btree (financial_account_id);
CREATE INDEX IF NOT EXISTS idx_contracts_manager ON public.contracts USING btree (manager);
CREATE INDEX IF NOT EXISTS idx_contracts_tax_type ON public.contracts USING btree (tax_type);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON public.financial_accounts USING btree (type);
CREATE INDEX IF NOT EXISTS idx_payroll_obligations_client_id ON public.payroll_obligations USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_payroll_obligations_competence ON public.payroll_obligations USING btree (competence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_obligations_gclick_id ON public.payroll_obligations USING btree (gclick_id) WHERE (gclick_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_payroll_obligations_status ON public.payroll_obligations USING btree (status);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_proposal_items ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (acesso total - mesma config atual)
CREATE POLICY "Allow all access for account_categories" ON public.account_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for cash_flow_transactions" ON public.cash_flow_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_onboarding FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_onboarding_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.contract_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for financial_accounts" ON public.financial_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.financial_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.financial_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.lead_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.onboarding_template_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.onboarding_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payroll_obligations" ON public.payroll_obligations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.process_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.process_template_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.process_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.processes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.pricing_service_catalog FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.pricing_proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.pricing_proposal_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. CONFIGURAÇÃO DO SUPABASE (config.toml)
-- ============================================================
-- project_id = "rvekakbpmkemgiwkkdok"
--
-- [functions.sync-gclick-obligations]
-- verify_jwt = false
--
-- [functions.send-task-to-zapier]
-- verify_jwt = false
--
-- [functions.receive-task-from-zapier]
-- verify_jwt = false
--
-- [functions.backup-data]
-- verify_jwt = false

-- ============================================================
-- 7. SECRETS NECESSÁRIOS
-- ============================================================
-- Os seguintes secrets devem ser configurados no Supabase:
-- - SUPABASE_SERVICE_ROLE_KEY (auto-gerado pelo Supabase)
-- - SUPABASE_DB_URL (auto-gerado pelo Supabase)
-- - SUPABASE_PUBLISHABLE_KEY (auto-gerado pelo Supabase)
-- - SUPABASE_URL (auto-gerado pelo Supabase)
-- - SUPABASE_ANON_KEY (auto-gerado pelo Supabase)
-- - GCLICK_APP_KEY (credencial da API G-Click)
-- - GCLICK_APP_SECRET (credencial da API G-Click)
-- - LOVABLE_API_KEY (chave do Lovable AI Gateway)

-- ============================================================
-- 8. VARIÁVEIS DE AMBIENTE DO FRONTEND
-- ============================================================
-- VITE_SUPABASE_URL = "https://rvekakbpmkemgiwkkdok.supabase.co"
-- VITE_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZWtha2JwbWtlbWdpd2trZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjEzODQsImV4cCI6MjA4NTg5NzM4NH0.u2dYj-8FPXt53JDAJIljl6wZmTzd0-4lq-LWsuvILlY"
-- VITE_SUPABASE_PROJECT_ID = "rvekakbpmkemgiwkkdok"

-- ============================================================
-- FIM DO BACKUP
-- ============================================================
