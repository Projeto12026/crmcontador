
-- =============================================
-- FASE 1: Remover políticas permissivas antigas
-- =============================================

-- account_categories
DROP POLICY IF EXISTS "Allow all access for account_categories" ON public.account_categories;
-- cash_flow_transactions
DROP POLICY IF EXISTS "Allow all access for cash_flow_transactions" ON public.cash_flow_transactions;
-- client_contacts
DROP POLICY IF EXISTS "Allow all access" ON public.client_contacts;
-- client_onboarding
DROP POLICY IF EXISTS "Allow all access" ON public.client_onboarding;
-- client_onboarding_items
DROP POLICY IF EXISTS "Allow all access" ON public.client_onboarding_items;
-- clients
DROP POLICY IF EXISTS "Allow all access" ON public.clients;
-- contract_services
DROP POLICY IF EXISTS "Allow all access" ON public.contract_services;
-- contracts
DROP POLICY IF EXISTS "Allow all access" ON public.contracts;
-- financial_accounts
DROP POLICY IF EXISTS "Allow all access for financial_accounts" ON public.financial_accounts;
-- financial_categories
DROP POLICY IF EXISTS "Allow all access" ON public.financial_categories;
-- financial_transactions
DROP POLICY IF EXISTS "Allow all access" ON public.financial_transactions;
-- lead_activities
DROP POLICY IF EXISTS "Allow all access" ON public.lead_activities;
-- leads
DROP POLICY IF EXISTS "Allow all access" ON public.leads;
-- onboarding_template_items
DROP POLICY IF EXISTS "Allow all access" ON public.onboarding_template_items;
-- onboarding_templates
DROP POLICY IF EXISTS "Allow all access" ON public.onboarding_templates;
-- payroll_obligations
DROP POLICY IF EXISTS "Allow all access to payroll_obligations" ON public.payroll_obligations;
-- process_steps
DROP POLICY IF EXISTS "Allow all access" ON public.process_steps;
-- process_template_steps
DROP POLICY IF EXISTS "Allow all access" ON public.process_template_steps;
-- process_templates
DROP POLICY IF EXISTS "Allow all access" ON public.process_templates;
-- processes
DROP POLICY IF EXISTS "Allow all access" ON public.processes;
-- settings
DROP POLICY IF EXISTS "Allow all access" ON public.settings;
-- tasks
DROP POLICY IF EXISTS "Allow all access" ON public.tasks;

-- =============================================
-- FASE 2: Criar políticas seguras (auth.uid() IS NOT NULL)
-- Permite acesso total apenas a usuários autenticados
-- =============================================

-- account_categories
CREATE POLICY "Authenticated users full access" ON public.account_categories FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- cash_flow_transactions
CREATE POLICY "Authenticated users full access" ON public.cash_flow_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- client_contacts
CREATE POLICY "Authenticated users full access" ON public.client_contacts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- client_onboarding
CREATE POLICY "Authenticated users full access" ON public.client_onboarding FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- client_onboarding_items
CREATE POLICY "Authenticated users full access" ON public.client_onboarding_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- clients
CREATE POLICY "Authenticated users full access" ON public.clients FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- contract_services
CREATE POLICY "Authenticated users full access" ON public.contract_services FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- contracts
CREATE POLICY "Authenticated users full access" ON public.contracts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- financial_accounts
CREATE POLICY "Authenticated users full access" ON public.financial_accounts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- financial_categories
CREATE POLICY "Authenticated users full access" ON public.financial_categories FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- financial_transactions
CREATE POLICY "Authenticated users full access" ON public.financial_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- lead_activities
CREATE POLICY "Authenticated users full access" ON public.lead_activities FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- leads
CREATE POLICY "Authenticated users full access" ON public.leads FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- onboarding_template_items
CREATE POLICY "Authenticated users full access" ON public.onboarding_template_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- onboarding_templates
CREATE POLICY "Authenticated users full access" ON public.onboarding_templates FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payroll_obligations
CREATE POLICY "Authenticated users full access" ON public.payroll_obligations FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_steps
CREATE POLICY "Authenticated users full access" ON public.process_steps FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_template_steps
CREATE POLICY "Authenticated users full access" ON public.process_template_steps FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_templates
CREATE POLICY "Authenticated users full access" ON public.process_templates FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- processes
CREATE POLICY "Authenticated users full access" ON public.processes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- settings
CREATE POLICY "Authenticated users full access" ON public.settings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tasks
CREATE POLICY "Authenticated users full access" ON public.tasks FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- FASE 3: Corrigir search_path da função
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
