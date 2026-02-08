# Backup Completo - CRM Contador
## Atualizado em: 2026-02-08

Este documento preserva toda a lógica de negócio, arquitetura, edge functions e regras do sistema para restauração ou migração.

---

# PARTE 1: ARQUITETURA DO SISTEMA

## 1.1 Stack Tecnológica
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **State**: TanStack React Query (cache + mutations)
- **Roteamento**: React Router DOM v6
- **Gráficos**: Recharts
- **Backend**: Supabase (Lovable Cloud) - Auth, Database, Edge Functions
- **Deploy**: Docker + Nginx (VPS via EasyPanel) ou Lovable Cloud

## 1.2 Rotas e Módulos

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/` | DashboardPage | Visão geral com 8 KPIs |
| `/auth` | AuthPage | Login/Signup (Supabase Auth) |
| `/tarefas` | TasksPage | 6 views de produtividade |
| `/clientes` | ClientsPage | CRUD de clientes |
| `/comercial` | CommercialPage | Pipeline de leads |
| `/contratos` | ContractsPage | Gestão de contratos |
| `/processos` | ProcessesPage | Kanban de processos |
| `/onboarding` | OnboardingPage | Checklist de onboarding |
| `/folha-pagamento` | PayrollPage | Obrigações G-Click |
| `/financeiro` | FinancialPage | 6 abas financeiras |
| `/precificacao` | PricingPage | Precificação de serviços |
| `/configuracoes` | SettingsPage | Integrações e backup |

## 1.3 Autenticação

- **Hook**: `useAuth.ts` - Listener `onAuthStateChange` + `getSession()`
- **Proteção**: `ProtectedRoutes` em `App.tsx` redireciona para `/auth` se não autenticado
- **RLS**: Todas as 25 tabelas exigem `auth.uid() IS NOT NULL`
- **Logout**: Via `supabase.auth.signOut()` no sidebar

## 1.4 Layout

- `AppLayout.tsx` - Sidebar colapsável com 10 itens de navegação + Configurações + Sair
- Nome do app: "CRM Contador"
- Email do usuário exibido no footer do sidebar

---

# PARTE 2: LÓGICA DE NEGÓCIO - MÓDULO FINANCEIRO

## 2.1 Plano de Contas (ACCOUNT_GROUPS)

Definido em `src/types/crm.ts`:

```typescript
export const ACCOUNT_GROUPS = {
  1: 'Receitas',
  2: 'Dízimos',
  3: 'Ofertas',
  4: 'Sonhos',
  5: 'Despesas Dedutíveis',
  6: 'Despesas',
  7: 'Banco/Caixa',
  8: 'Cartões de Crédito',
  100: 'Despesa Nescon',
  200: 'Despesas de Terceiros',
} as const;
```

### Regra de Exclusão (EXCLUDED_ACCOUNT_GROUPS)

```typescript
export const EXCLUDED_ACCOUNT_GROUPS = new Set([100, 200]);
```

**Onde é aplicada:**
- `useCashFlowSummary` (hook) - Exclui dos totais dos cards de resumo
- `CashFlowProjectionView` - Exclui da tabela de projeção
- `InstallmentExpensesView` - Exclui do rastreamento de parceladas
- `FinancialDashboardView` - Exclui do ranking de despesas, parcelas e projeção de caixa livre

**Exceção**: No **Fluxo de Caixa** (tabela de lançamentos), os grupos 100/200 **aparecem** normalmente, apenas são excluídos dos cálculos analíticos.

**Exceção de filtro financeiro**: Quando uma **conta financeira específica** é selecionada, os summary cards incluem todos os grupos para que o saldo exibido corresponda à soma visível na tabela.

### Cores do Plano de Contas (AccountCategoryTree)

```typescript
const groupColors = {
  1: 'bg-green-*',    // Receitas
  2: 'bg-blue-*',     // Dízimos
  3: 'bg-purple-*',   // Ofertas
  4: 'bg-yellow-*',   // Sonhos
  5: 'bg-orange-*',   // Despesas Dedutíveis
  6: 'bg-red-*',      // Despesas
  7: 'bg-cyan-*',     // Banco/Caixa
  8: 'bg-pink-*',     // Cartões de Crédito
  100: 'bg-amber-*',  // Despesa Nescon
  200: 'bg-slate-*',  // Despesas de Terceiros
};
```

## 2.2 Lógica de Entrada de Transações

**Arquivo**: `TransactionFormDialog.tsx` + `useCashFlow.ts (useCreateCashFlowTransaction)`

### Regras:
1. **Valor** = valor por parcela (não o total)
2. **Destino/Origem** = preenchido automaticamente com a descrição
3. **Padrão**: Todo lançamento novo é "Projetado" (is_future)
4. **Parcelamento**: Adiciona sufixo `(N/Total)` na descrição; parcelas 2+ são sempre projetadas
5. **Contas permitidas por tipo**:
   - Receita (income): Grupos 1-4
   - Despesa (expense): Grupos 5-6, 100, 200

### Campos de valor na tabela `cash_flow_transactions`:
- `income` / `expense` = valores **realizados**
- `future_income` / `future_expense` = valores **projetados**
- `value` = valor absoluto da transação

### Liquidação (useSettleTransaction):
Move `future_income → income` ou `future_expense → expense`, zerando o valor futuro.

## 2.3 Fluxo de Caixa (aba "Fluxo de Caixa")

**Arquivo**: `FinancialPage.tsx` + componentes

### Filtros disponíveis (CashFlowFilters):
1. **Data Inicial / Final** → query no Supabase
2. **Tipo** (Receita/Despesa) → query no Supabase
3. **Grupo** (1-8, 100, 200) → filtro local
4. **Conta do Plano de Contas** → query no Supabase
5. **Conta Financeira** → query no Supabase + local
6. **Status** (Projetado/Realizado/Misto) → filtro local
7. **Pesquisa** (descrição, valor, origem) → filtro local

### Race condition resolvida:
Ao mudar o Grupo, accountId é resetado no mesmo `onFiltersChange` para evitar race condition.

### Recálculo de Summary Cards:
Quando filtros locais (Grupo, Status, Pesquisa) estão ativos, os totais são recalculados a partir das `filteredTransactions` via `useMemo`, não da query do banco.

### Summary Cards (CashFlowSummaryCards):
- Receitas Executadas (verde)
- Despesas Executadas (vermelho)
- Receitas Projetadas (azul)
- Despesas Projetadas (laranja)
- Saldo Realizado (verde/vermelho conforme positivo/negativo)

## 2.4 Dashboard Financeiro (aba "Dashboard")

**Arquivo**: `FinancialDashboardView.tsx`

### Componentes:
1. **Top 10 Maiores Despesas** por conta contábil (barra horizontal)
2. **Despesas Parceladas** (tabela com parcelas, valor total, meses restantes)
3. **Projeção de Dinheiro Livre** (gráfico de barras receitas x despesas x acumulado)

### Filtros (DashboardFilters):
- Modo: Mês, Ano, Personalizado
- Operação independente dos filtros do Fluxo de Caixa

### Detecção de Parcelas (Dashboard):
Regex: `/^(.+?)\s*\((\d+)\/(\d+)\)$/`
Agrupamento por: baseName + totalInstallments + account_id

## 2.5 Projeção de Fluxo de Caixa (aba "Projeção")

**Arquivo**: `CashFlowProjectionView.tsx`

### Funcionamento:
- Tabela matricial: Contas x Meses
- Exclui grupos > 6 e EXCLUDED_ACCOUNT_GROUPS
- Mostra indicadores: (P) = Projetado, (M) = Misto
- Linha "Resultado do Mês" (soma)
- Linha "Saldo Acumulado" (running balance)

### Filtros:
- Data inicial + quantidade de meses (3, 6, 12, 24)

## 2.6 Despesas Parceladas (aba "Parceladas")

**Arquivo**: `InstallmentExpensesView.tsx`

### Detecção automática:
1. Filtra apenas despesas (exclui EXCLUDED_ACCOUNT_GROUPS)
2. Remove sufixo de parcela via regex: `/\s*\(\d+\/\d+\)\s*$/`
3. Agrupa por: `baseDescription + account_id + value`
4. Exige: 2+ transações + mesmo dia do mês (hasFixedDay)

### Dados exibidos:
- Descrição base, conta, valor/parcela, dia do mês
- Parcelas pagas vs total (com barra de progresso)
- Total pago, total a pagar, primeira/última parcela
- Meses restantes com badges coloridas

### Summary Cards:
- Grupos de Parcelas (quantidade)
- Total a Pagar (futuro) em vermelho
- Valor Total Comprometido

## 2.7 Contas Financeiras (aba "Contas")

**Arquivo**: `FinancialAccountsManager.tsx` + `useFinancialAccounts.ts`

### Tipos: bank, cash, credit
### CRUD completo com:
- Recálculo de saldo (`useRecalculateBalance`): saldo_inicial + sum(income + future_income) - sum(expense + future_expense)
- Vinculação opcional a account_category (relação 1:1)

## 2.8 useCashFlowSummary (Hook de Resumo)

**Arquivo**: `useCashFlow.ts`

### Filtro de dados:
- Exclui grupos 7, 8, 100, 200 dos totais
- Aceita filtro por conta financeira (financialAccountId)

### Campos calculados:
```typescript
interface CashFlowSummary {
  totalIncome: number;        // income + future_income
  totalExpense: number;       // expense + future_expense
  balance: number;            // totalIncome - totalExpense
  projectedIncome: number;    // future_income
  projectedExpense: number;   // future_expense
  executedIncome: number;     // income
  executedExpense: number;    // expense
  executedBalance: number;    // executedIncome - executedExpense
  transactionCount: number;
}
```

---

# PARTE 3: LÓGICA DE NEGÓCIO - OUTROS MÓDULOS

## 3.1 Dashboard Principal

**Arquivo**: `DashboardPage.tsx` + `useDashboard.ts`

8 KPIs: Clientes Ativos, Contratos Ativos, Tarefas Pendentes, Leads Abertos, Receita do Mês, Pagamentos Atrasados, Processos em Andamento, Onboardings Ativos.

## 3.2 Tarefas (6 Views de Produtividade)

**Views disponíveis** (definidas em `TaskViewType`):
- Lista, Matriz de Eisenhower, Kanban, Duas Listas (Foco x Backlog), Coma o Sapo, Ivy Lee

**Campos especiais**: `is_important`, `is_urgent`, `is_frog`, `ivy_lee_order`, `is_focus_list`, `enabled_views[]`

## 3.3 Folha de Pagamento

- Sincronização via Edge Function `sync-gclick-obligations` (API G-Click)
- Filtros: mês específico, ano completo, período customizado
- Mapeamento de status: C/D/O → completed; data vencida → delayed; demais → pending
- Competência formatada: MMM/AAAA

## 3.4 Precificação

- Catálogo de serviços com horas/mês padrão por departamento
- Propostas com cálculo de markup (impostos, inadimplência, juros, lucro)
- Diagnóstico de complexidade do cliente (regime tributário, nº funcionários, etc.)

## 3.5 Contratos

- Campos: manager (nescon/jean), tax_type (simples/lp/mei), billing_day
- Serviços vinculados com valor individual

---

# PARTE 4: EDGE FUNCTIONS

## 4.1 sync-gclick-obligations/index.ts

Sincroniza obrigações de folha de pagamento com a API G-Click.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GCLICK_API_URL = 'https://api.gclick.com.br';

interface GClickTask {
  id: string;
  status: string;
  dataCompetencia: string;
  dataAcao: string;
  dataMeta: string;
  dataVencimento: string;
  dataConclusao: string | null;
  nome: string;
  clienteInscricao: string;
  clienteApelido: string;
  obrigacao?: { nome: string; departamento?: { nome: string } };
  departamento?: { nome: string };
}

interface GClickResponse {
  content: GClickTask[];
  last: boolean;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  console.log('Getting G-Click access token...');
  
  const response = await fetch(`${GCLICK_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Auth failed:', response.status, errorText);
    throw new Error(`Falha na autenticação: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchTasks(accessToken: string, params: Record<string, string>): Promise<GClickTask[]> {
  const allTasks: GClickTask[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < 20) {
    const queryParams = new URLSearchParams({ ...params, size: '100', page: page.toString() });
    
    const response = await fetch(`${GCLICK_API_URL}/tarefas?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fetch failed:', response.status, errorText);
      throw new Error(`Falha ao buscar tarefas: ${response.status}`);
    }

    const data: GClickResponse = await response.json();
    allTasks.push(...data.content);
    hasMore = !data.last;
    page++;
  }

  return allTasks;
}

function mapStatus(status: string, dataMeta: string): string {
  if (['C', 'D', 'O'].includes(status)) return 'completed';
  
  if (dataMeta) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(dataMeta) < today) return 'delayed';
  }
  
  return 'pending';
}

function formatCompetence(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  return `${months[date.getMonth()]}/${date.getFullYear()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GCLICK_APP_KEY = Deno.env.get('GCLICK_APP_KEY');
    const GCLICK_APP_SECRET = Deno.env.get('GCLICK_APP_SECRET');
    
    if (!GCLICK_APP_KEY || !GCLICK_APP_SECRET) {
      throw new Error('Credenciais G-Click não configuradas');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json().catch(() => ({}));
    const { type = 'folha_pagamento' } = body;
    
    console.log(`Starting sync for: ${type}`);

    const accessToken = await getAccessToken(GCLICK_APP_KEY, GCLICK_APP_SECRET);

    const params: Record<string, string> = { categoria: 'Obrigacao' };
    if (type === 'folha_pagamento') params.nome = 'Folha de pagamento';

    const tasks = await fetchTasks(accessToken, params);
    console.log(`Fetched ${tasks.length} tasks`);

    let syncedCount = 0;

    for (const task of tasks) {
      const obligationData = {
        gclick_id: task.id,
        client_name: task.clienteApelido || 'Cliente',
        client_cnpj: task.clienteInscricao || '',
        client_status: 'Ativo',
        department: task.departamento?.nome || 'Departamento Pessoal',
        obligation_name: task.nome || 'Folha de pagamento',
        competence: formatCompetence(task.dataCompetencia || task.dataAcao),
        due_date: task.dataMeta || task.dataVencimento || null,
        status: mapStatus(task.status, task.dataMeta),
        completed_at: task.dataConclusao,
        updated_at: new Date().toISOString(),
      };

      const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/payroll_obligations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(obligationData),
      });

      if (upsertResponse.ok) {
        syncedCount++;
      } else {
        const errText = await upsertResponse.text();
        console.error(`Upsert error for ${task.id}:`, errText);
      }
    }

    console.log(`Synced: ${syncedCount}/${tasks.length}`);

    return new Response(
      JSON.stringify({ success: true, synced: syncedCount, total: tasks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

---

## 4.2 send-task-to-zapier/index.ts

Envia tarefas para o Zapier via webhook (integração com Google Tasks).

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskPayload {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
  status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { webhookUrl, task } = await req.json() as {
      webhookUrl: string;
      task: TaskPayload;
    };

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: "Webhook URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!task || !task.title) {
      return new Response(
        JSON.stringify({ error: "Task title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapierPayload = {
      title: task.title,
      notes: task.description || "",
      due: task.due_date || null,
      priority: task.priority || "medium",
      status: task.status || "pending",
      timestamp: new Date().toISOString(),
    };

    console.log("Sending task to Zapier webhook:", webhookUrl);
    console.log("Payload:", zapierPayload);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zapierPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Zapier webhook failed [${response.status}]:`, errorText);
      throw new Error(`Zapier webhook failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("Successfully sent task to Zapier");

    return new Response(
      JSON.stringify({ success: true, message: "Task sent to Zapier successfully", zapierResponse: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-task-to-zapier:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 4.3 receive-task-from-zapier/index.ts

Recebe tarefas do Zapier (Google Tasks → CRM).

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTaskPayload {
  title: string;
  notes?: string;
  due?: string;
  status?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: GoogleTaskPayload = await req.json();
    console.log('Received task from Zapier:', JSON.stringify(payload));

    if (!payload.title) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const taskStatus = payload.status === 'completed' ? 'completed' : 'pending';
    let dueDate: string | null = null;
    
    if (payload.due) {
      try {
        dueDate = new Date(payload.due).toISOString().split('T')[0];
      } catch (e) {
        console.warn('Could not parse due date:', payload.due);
      }
    }

    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('title', payload.title)
      .limit(1);

    if (existingTasks && existingTasks.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Task already exists', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        title: payload.title,
        description: payload.notes || null,
        due_date: dueDate,
        status: taskStatus,
        priority: 'medium',
        completed_at: taskStatus === 'completed' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, task: newTask }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 4.4 backup-data/index.ts

Exporta todos os dados de todas as 25 tabelas do sistema em JSON, com paginação para contornar o limite de 1000 registros.

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "clients",
  "client_contacts",
  "client_onboarding",
  "client_onboarding_items",
  "contracts",
  "contract_services",
  "financial_accounts",
  "financial_categories",
  "financial_transactions",
  "cash_flow_transactions",
  "account_categories",
  "leads",
  "lead_activities",
  "tasks",
  "processes",
  "process_steps",
  "process_templates",
  "process_template_steps",
  "onboarding_templates",
  "onboarding_template_items",
  "payroll_obligations",
  "pricing_service_catalog",
  "pricing_proposals",
  "pricing_proposal_items",
  "settings",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];

    for (const table of TABLES) {
      try {
        let allRows: unknown[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .range(from, from + pageSize - 1);

          if (error) {
            errors.push(`${table}: ${error.message}`);
            hasMore = false;
          } else {
            allRows = allRows.concat(data || []);
            hasMore = (data?.length || 0) === pageSize;
            from += pageSize;
          }
        }

        backup[table] = allRows;
        console.log(`Table ${table}: ${allRows.length} rows`);
      } catch (e) {
        errors.push(`${table}: ${e.message}`);
        backup[table] = [];
      }
    }

    const result = {
      backup_date: new Date().toISOString(),
      backup_by: user.email,
      tables: backup,
      table_counts: Object.fromEntries(
        Object.entries(backup).map(([k, v]) => [k, v.length])
      ),
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

# PARTE 5: CONFIGURAÇÃO

## 5.1 supabase/config.toml

```toml
project_id = "rvekakbpmkemgiwkkdok"

[functions.sync-gclick-obligations]
verify_jwt = false

[functions.send-task-to-zapier]
verify_jwt = false

[functions.receive-task-from-zapier]
verify_jwt = false

[functions.backup-data]
verify_jwt = false
```

## 5.2 Secrets Necessários

| Secret | Uso |
|--------|-----|
| GCLICK_APP_KEY | API G-Click (OAuth2 client_id) |
| GCLICK_APP_SECRET | API G-Click (OAuth2 client_secret) |
| SUPABASE_URL | Automático |
| SUPABASE_ANON_KEY | Automático |
| SUPABASE_SERVICE_ROLE_KEY | Automático |

## 5.3 Página de Configurações

**Arquivo**: `SettingsPage.tsx`

### Funcionalidades:
1. **Integração G-Click**: App Key + App Secret (armazenados na tabela `settings`)
2. **Integração Zapier**: URL do webhook (armazenado na tabela `settings`)
3. **Backup do Sistema**:
   - Backup Completo (JSON com metadados)
   - Apenas Dados (JSON só com tabelas)
   - Timestamp do último backup persistido em `settings`

### O backup inclui:
- Clientes, contatos e contratos
- Transações financeiras e fluxo de caixa
- Tarefas, processos e templates
- Leads e atividades comerciais
- Obrigações de folha de pagamento
- Precificação: catálogo de serviços e propostas
- Configurações do sistema

---

# PARTE 6: SEGURANÇA

## 6.1 RLS (Row Level Security)
- Todas as 25 tabelas com RLS habilitado
- Política: `auth.uid() IS NOT NULL` para SELECT, INSERT, UPDATE, DELETE
- Tabela `settings` possui UNIQUE constraint em `key`

## 6.2 Funções de Banco
- `update_updated_at_column()` com `SET search_path = public`
- Triggers em todas as tabelas com campo `updated_at`

## 6.3 Edge Functions
- Verificação de JWT desabilitada no config (validação manual no código)
- `backup-data` valida token do usuário antes de exportar
- `receive-task-from-zapier` sem auth (webhook público)
