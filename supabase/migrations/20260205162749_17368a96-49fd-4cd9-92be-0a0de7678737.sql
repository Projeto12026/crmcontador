-- =============================================
-- MIGRAÇÃO COMPLETA DO MÓDULO FINANCEIRO
-- Plano de Contas hierárquico + Fluxo de Caixa
-- =============================================

-- 1. Criar enum para tipo de conta financeira
CREATE TYPE public.financial_account_type AS ENUM ('bank', 'cash', 'credit');

-- 2. Criar tabela de Plano de Contas (AccountCategory)
-- ID numérico hierárquico (ex: 1, 1.1, 1.2, 2, 2.1)
CREATE TABLE public.account_categories (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  group_number INTEGER NOT NULL CHECK (group_number BETWEEN 1 AND 8),
  parent_id TEXT REFERENCES public.account_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Comentário sobre os grupos:
-- 1 – Receitas
-- 2 – Dízimos
-- 3 – Ofertas
-- 4 – Sonhos
-- 5 – Despesas dedutíveis
-- 6 – Despesas
-- 7 – Banco/Caixa
-- 8 – Cartões de Crédito

-- 3. Criar tabela de Contas Financeiras
CREATE TABLE public.financial_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type public.financial_account_type NOT NULL,
  initial_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  account_category_id TEXT UNIQUE REFERENCES public.account_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Criar nova tabela de Lançamentos com suporte a projetado/executado
CREATE TABLE public.cash_flow_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  account_id TEXT NOT NULL REFERENCES public.account_categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  
  -- Valores futuros (projetados)
  future_income NUMERIC(18, 2) DEFAULT 0,
  future_expense NUMERIC(18, 2) DEFAULT 0,
  
  -- Valores realizados (executados)
  income NUMERIC(18, 2) DEFAULT 0,
  expense NUMERIC(18, 2) DEFAULT 0,
  
  -- Valor de referência
  value NUMERIC(18, 2) NOT NULL,
  
  origin_destination TEXT NOT NULL,
  financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  paid_by_company BOOLEAN NOT NULL DEFAULT false,
  
  -- Vínculo opcional com cliente/contrato
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Validação: pelo menos um valor deve ser > 0
  CONSTRAINT at_least_one_value CHECK (
    COALESCE(future_income, 0) > 0 OR 
    COALESCE(future_expense, 0) > 0 OR 
    COALESCE(income, 0) > 0 OR 
    COALESCE(expense, 0) > 0
  )
);

-- 5. Habilitar RLS nas novas tabelas
ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_transactions ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS (abertas para desenvolvimento, restringir depois)
CREATE POLICY "Allow all access for account_categories" 
  ON public.account_categories FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for financial_accounts" 
  ON public.financial_accounts FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for cash_flow_transactions" 
  ON public.cash_flow_transactions FOR ALL 
  USING (true) WITH CHECK (true);

-- 7. Triggers para updated_at
CREATE TRIGGER update_account_categories_updated_at
  BEFORE UPDATE ON public.account_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_accounts_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cash_flow_transactions_updated_at
  BEFORE UPDATE ON public.cash_flow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Índices para performance
CREATE INDEX idx_account_categories_group ON public.account_categories(group_number);
CREATE INDEX idx_account_categories_parent ON public.account_categories(parent_id);
CREATE INDEX idx_cash_flow_transactions_date ON public.cash_flow_transactions(date);
CREATE INDEX idx_cash_flow_transactions_account ON public.cash_flow_transactions(account_id);
CREATE INDEX idx_cash_flow_transactions_financial_account ON public.cash_flow_transactions(financial_account_id);
CREATE INDEX idx_financial_accounts_type ON public.financial_accounts(type);

-- 9. Inserir dados iniciais do Plano de Contas
INSERT INTO public.account_categories (id, name, group_number, parent_id) VALUES
-- Grupo 1: Receitas
('1', 'Receitas', 1, NULL),
('1.1', 'Honorários Contábeis', 1, '1'),
('1.2', 'Consultoria', 1, '1'),
('1.3', 'Outras Receitas', 1, '1'),

-- Grupo 2: Dízimos
('2', 'Dízimos', 2, NULL),
('2.1', 'Dízimo Mensal', 2, '2'),

-- Grupo 3: Ofertas
('3', 'Ofertas', 3, NULL),
('3.1', 'Ofertas Especiais', 3, '3'),

-- Grupo 4: Sonhos
('4', 'Sonhos', 4, NULL),
('4.1', 'Investimentos', 4, '4'),
('4.2', 'Reserva de Emergência', 4, '4'),

-- Grupo 5: Despesas Dedutíveis
('5', 'Despesas Dedutíveis', 5, NULL),
('5.1', 'Impostos', 5, '5'),
('5.2', 'Contribuições Previdenciárias', 5, '5'),
('5.3', 'Taxas e Licenças', 5, '5'),

-- Grupo 6: Despesas
('6', 'Despesas', 6, NULL),
('6.1', 'Despesas Administrativas', 6, '6'),
('6.2', 'Salários e Encargos', 6, '6'),
('6.3', 'Aluguel e Condomínio', 6, '6'),
('6.4', 'Energia e Água', 6, '6'),
('6.5', 'Telefone e Internet', 6, '6'),
('6.6', 'Material de Escritório', 6, '6'),
('6.7', 'Software e Sistemas', 6, '6'),
('6.8', 'Marketing', 6, '6'),
('6.9', 'Outras Despesas', 6, '6'),

-- Grupo 7: Banco/Caixa
('7', 'Banco/Caixa', 7, NULL),
('7.1', 'Caixa Geral', 7, '7'),
('7.2', 'Banco Principal', 7, '7'),

-- Grupo 8: Cartões de Crédito
('8', 'Cartões de Crédito', 8, NULL);

-- 10. Criar contas financeiras padrão vinculadas ao grupo 7
INSERT INTO public.financial_accounts (id, name, type, initial_balance, current_balance, account_category_id) VALUES
(gen_random_uuid(), 'Caixa Geral', 'cash', 0, 0, '7.1'),
(gen_random_uuid(), 'Banco Principal', 'bank', 0, 0, '7.2');