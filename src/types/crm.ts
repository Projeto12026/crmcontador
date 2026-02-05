// Tipos base do CRM para Contador

// ============================================
// ENUMS
// ============================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type LeadStatus = 'prospecting' | 'contact' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type ProcessStatus = 'pending' | 'in_progress' | 'awaiting_docs' | 'awaiting_client' | 'completed' | 'cancelled';
export type ContractStatus = 'draft' | 'active' | 'suspended' | 'cancelled' | 'expired';
export type OnboardingStatus = 'pending' | 'in_progress' | 'completed';
export type FinancialStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type TransactionType = 'income' | 'expense';
export type ClientStatus = 'active' | 'inactive' | 'blocked';
export type ContractManager = 'nescon' | 'jean';
export type TaxType = 'simples' | 'lp' | 'mei';

// Task Views for productivity strategies
export type TaskViewType = 'list' | 'eisenhower' | 'kanban' | 'two_lists' | 'eat_frog' | 'ivy_lee';

// ============================================
// INTERFACES
// ============================================

export interface Client {
  id: string;
  name: string;
  trading_name: string | null;
  document: string | null;
  document_type: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  is_active: boolean;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Productivity strategy fields
  is_important: boolean;
  is_urgent: boolean;
  is_frog: boolean;
  ivy_lee_order: number | null;
  is_focus_list: boolean;
  enabled_views: TaskViewType[];
  client?: Pick<Client, 'id' | 'name'> | null;
}

export interface Lead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  expected_value: number | null;
  notes: string | null;
  converted_client_id: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps?: ProcessTemplateStep[];
}

export interface ProcessTemplateStep {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  order_index: number;
  estimated_days: number | null;
  created_at: string;
}

export interface Process {
  id: string;
  client_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  status: ProcessStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  steps?: ProcessStep[];
}

export interface ProcessStep {
  id: string;
  process_id: string;
  name: string;
  description: string | null;
  order_index: number;
  status: ProcessStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  description: string | null;
  status: ContractStatus;
  monthly_value: number | null;
  start_date: string | null;
  end_date: string | null;
  billing_day: number | null;
  notes: string | null;
  manager: ContractManager | null;
  tax_type: TaxType | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, 'id' | 'name'> | null;
  services?: ContractService[];
}

export interface ContractService {
  id: string;
  contract_id: string;
  service_name: string;
  description: string | null;
  value: number | null;
  created_at: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: OnboardingTemplateItem[];
}

export interface OnboardingTemplateItem {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
}

export interface ClientOnboarding {
  id: string;
  client_id: string;
  template_id: string | null;
  status: OnboardingStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  items?: ClientOnboardingItem[];
}

export interface ClientOnboardingItem {
  id: string;
  onboarding_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// FINANCEIRO - NOVO MODELO DE DADOS
// ============================================

export type FinancialAccountType = 'bank' | 'cash' | 'credit';

// Grupos do Plano de Contas
export const ACCOUNT_GROUPS = {
  1: 'Receitas',
  2: 'Dízimos',
  3: 'Ofertas',
  4: 'Sonhos',
  5: 'Despesas Dedutíveis',
  6: 'Despesas',
  7: 'Banco/Caixa',
  8: 'Cartões de Crédito',
} as const;

export type AccountGroupNumber = keyof typeof ACCOUNT_GROUPS;

// Plano de Contas hierárquico
export interface AccountCategory {
  id: string; // ID numérico hierárquico (ex: 1, 1.1, 1.2)
  name: string;
  group_number: AccountGroupNumber;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  subcategories?: AccountCategory[];
  financial_account?: FinancialAccount | null;
}

// Contas Financeiras (Caixa, Bancos, Cartões)
export interface FinancialAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  initial_balance: number;
  current_balance: number;
  account_category_id: string | null;
  created_at: string;
  updated_at: string;
  account_category?: AccountCategory | null;
}

// Lançamentos do Fluxo de Caixa
export interface CashFlowTransaction {
  id: string;
  date: string;
  account_id: string;
  description: string;
  future_income: number;
  future_expense: number;
  income: number;
  expense: number;
  value: number;
  origin_destination: string;
  financial_account_id: string | null;
  type: TransactionType;
  paid_by_company: boolean;
  client_id: string | null;
  contract_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  account?: AccountCategory | null;
  financial_account?: FinancialAccount | null;
  client?: Pick<Client, 'id' | 'name'> | null;
}

// Resumo do Fluxo de Caixa
export interface CashFlowSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  projectedIncome: number;
  projectedExpense: number;
  executedIncome: number;
  executedExpense: number;
  executedBalance: number;
  transactionCount: number;
}

// Fluxo por conta e mês
export interface CashFlowByAccount {
  accountId: string;
  accountName: string;
  groupNumber: AccountGroupNumber;
  months: {
    [key: string]: { // YYYY-MM
      projected: number;
      executed: number;
    };
  };
}

// ============================================
// FINANCEIRO ANTIGO (manter compatibilidade)
// ============================================

export interface FinancialCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FinancialTransaction {
  id: string;
  client_id: string | null;
  contract_id: string | null;
  category_id: string | null;
  type: TransactionType;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: FinancialStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, 'id' | 'name'> | null;
  category?: Pick<FinancialCategory, 'id' | 'name' | 'color'> | null;
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface ClientFormData {
  name: string;
  trading_name?: string;
  document?: string;
  document_type?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  status?: ClientStatus;
}

export interface TaskFormData {
  title: string;
  description?: string;
  client_id?: string;
  priority: PriorityLevel;
  due_date?: string;
  is_important?: boolean;
  is_urgent?: boolean;
  is_frog?: boolean;
  ivy_lee_order?: number;
  is_focus_list?: boolean;
  enabled_views?: TaskViewType[];
}

export interface LeadFormData {
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source?: string;
  expected_value?: number;
  notes?: string;
}

export interface ProcessFormData {
  client_id: string;
  template_id?: string;
  title: string;
  description?: string;
}

export interface ContractFormData {
  client_id?: string | null;
  client_name?: string | null;
  title: string;
  description?: string;
  monthly_value?: number;
  start_date?: string;
  end_date?: string;
  billing_day?: number;
  notes?: string;
  manager?: ContractManager;
  tax_type?: TaxType;
}

export interface TransactionFormData {
  client_id?: string;
  contract_id?: string;
  category_id?: string;
  type: TransactionType;
  description: string;
  amount: number;
  due_date: string;
  notes?: string;
}

// Form para novo lançamento do Fluxo de Caixa
export interface CashFlowTransactionFormData {
  date: string;
  account_id: string;
  description: string;
  value: number;
  origin_destination: string;
  type: TransactionType;
  financial_account_id?: string;
  is_future?: boolean; // Se true, usa future_income/future_expense
  client_id?: string;
  contract_id?: string;
  notes?: string;
  paid_by_company?: boolean;
  // Campos para parcelamento
  is_installment?: boolean;
  installment_count?: number;
}

// Form para Conta do Plano de Contas
export interface AccountCategoryFormData {
  id: string;
  name: string;
  group_number: number;
  parent_id?: string;
  create_financial_account?: boolean;
  financial_account_type?: FinancialAccountType;
  financial_account_initial_balance?: number;
}

// Form para Conta Financeira
export interface FinancialAccountFormData {
  name: string;
  type: FinancialAccountType;
  initial_balance: number;
  account_category_id?: string;
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface DashboardStats {
  totalClients: number;
  activeContracts: number;
  pendingTasks: number;
  openLeads: number;
  monthlyRevenue: number;
  overdueTransactions: number;
  processesInProgress: number;
  onboardingsInProgress: number;
}

// ============================================
// PRODUCTIVITY VIEW LABELS
// ============================================

export const taskViewLabels: Record<TaskViewType, { label: string; icon: string; description: string }> = {
  list: { label: 'Lista', icon: '📋', description: 'Visualização em lista simples' },
  eisenhower: { label: 'Matriz de Eisenhower', icon: '🎯', description: 'Urgente x Importante' },
  kanban: { label: 'Kanban', icon: '📊', description: 'Por status em colunas' },
  two_lists: { label: 'Duas Listas', icon: '📋', description: 'Foco x Backlog' },
  eat_frog: { label: 'Coma o Sapo', icon: '🐸', description: 'Tarefa mais difícil primeiro' },
  ivy_lee: { label: 'Ivy Lee', icon: '6️⃣', description: '6 tarefas prioritárias do dia' },
};
