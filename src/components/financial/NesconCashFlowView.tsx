import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, parseISO, isSameMonth, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, TrendingDown, Wallet, Clock, CheckCircle, BarChart3, CalendarRange, FileText, CircleDollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CashFlowTransaction, CashFlowSummary } from '@/types/crm';
import { CashFlowFilters, CashFlowFiltersValues } from '@/components/financial/CashFlowFilters';
import { TransactionsTable } from '@/components/financial/TransactionsTable';
import { DashboardFilters, DashboardFilterValues } from '@/components/financial/DashboardFilters';

import { useCashFlowTransactions, useCashFlowSummary, useSettleTransaction, useDeleteCashFlowTransaction } from '@/hooks/useCashFlow';
import { useAccountCategoriesFlat } from '@/hooks/useAccountCategories';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
  '#f59e0b',
  '#10b981',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#8b5cf6',
];

const AJUSTE_RECEITAS = 2800;
const CORA_THRESHOLD = 14000;

/**
 * Applies the R$ 2,800 revenue adjustment to the summary.
 */
function adjustSummary(summary: CashFlowSummary): CashFlowSummary {
  return {
    ...summary,
    executedIncome: summary.executedIncome - AJUSTE_RECEITAS,
    projectedIncome: summary.projectedIncome - AJUSTE_RECEITAS,
    totalIncome: summary.totalIncome - AJUSTE_RECEITAS,
    balance: summary.balance - AJUSTE_RECEITAS,
    executedBalance: summary.executedBalance - AJUSTE_RECEITAS,
  };
}

// ============================================================
// SUB-COMPONENT: NesconSummaryCards (with adjustment)
// ============================================================
function NesconSummaryCards({ summary, isLoading, totalProjectedExpense }: { summary: CashFlowSummary; isLoading?: boolean; totalProjectedExpense?: number }) {
  const adjusted = adjustSummary(summary);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2"><div className="h-4 bg-muted rounded w-20" /></CardHeader>
            <CardContent><div className="h-8 bg-muted rounded w-28" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Receitas Executadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(adjusted.executedIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Despesas Executadas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(adjusted.executedExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Receitas Projetadas</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{formatCurrency(adjusted.projectedIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Despesas Projetadas</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{formatCurrency(adjusted.projectedExpense)}</div>
            {totalProjectedExpense !== undefined && totalProjectedExpense !== adjusted.projectedExpense && (
              <p className="text-xs text-muted-foreground mt-1">* Total: {formatCurrency(totalProjectedExpense)}</p>
            )}
          </CardContent>
        </Card>
        <Card className={adjusted.executedBalance >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Saldo Realizado</CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${adjusted.executedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(adjusted.executedBalance)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENT: NesconProjectionView (with adjustment)
// ============================================================
function NesconProjectionView({ 
  transactions, 
  isLoading, 
  startDate, 
  monthsToShow = 6 
}: { 
  transactions: CashFlowTransaction[]; 
  isLoading?: boolean; 
  startDate: string; 
  monthsToShow?: number; 
}) {
  const months = useMemo(() => {
    const result: Date[] = [];
    const [year, month] = startDate.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    for (let i = 0; i < monthsToShow; i++) {
      result.push(addMonths(start, i));
    }
    return result;
  }, [startDate, monthsToShow]);

  const { groupTotals, monthTotals, dre, finalBalance } = useMemo(() => {
    const groupTotals: Record<number, Record<string, number>> = {};
    const monthTotals: Record<string, number> = {};

    months.forEach(m => {
      const key = format(m, 'yyyy-MM');
      monthTotals[key] = 0;
    });

    transactions.forEach(tx => {
      const txDate = parseISO(tx.date);
      const monthKey = format(txDate, 'yyyy-MM');
      if (!months.some(m => isSameMonth(m, txDate))) return;
      
      const group = tx.account?.group_number;
      if (!group || group > 11) return;

      if (!groupTotals[group]) {
        groupTotals[group] = {};
        months.forEach(m => { groupTotals[group][format(m, 'yyyy-MM')] = 0; });
      }

      const futureValue = tx.type === 'income' ? (tx.future_income || 0) : (tx.future_expense || 0);
      const executedValue = tx.type === 'income' ? (tx.income || 0) : (tx.expense || 0);
      const total = futureValue + executedValue;

      if (groupTotals[group][monthKey] !== undefined) {
        groupTotals[group][monthKey] += total;
      }
    });

    // DRE structure per month
    const GROUP_NAMES: Record<number, string> = {
      1: '1 - Receitas',
      2: '2 - Despesas Marketing/Vendas',
      3: '3 - Despesas Operacionais',
      4: '4 - Folha de Pagamento',
      5: '5 - Pró-labore Sócios',
      6: '6 - Manutenções',
      7: '7 - Imobilizado',
      8: '8 - Despesas não Operacionais',
      9: '9 - Materiais de Limpeza',
      10: '10 - Taxas',
      11: '11 - Despesas Financeiras',
    };

    // Build DRE rows
    type DreRow = { label: string; type: 'group' | 'subtotal' | 'total'; groupNum?: number; getValue: (key: string) => number };
    const dre: DreRow[] = [
      { label: GROUP_NAMES[1], type: 'group', groupNum: 1, getValue: (k) => (groupTotals[1]?.[k] || 0) - AJUSTE_RECEITAS },
      { label: GROUP_NAMES[2], type: 'group', groupNum: 2, getValue: (k) => groupTotals[2]?.[k] || 0 },
      { label: '= Receita Líquida', type: 'subtotal', getValue: (k) => ((groupTotals[1]?.[k] || 0) - AJUSTE_RECEITAS) - (groupTotals[2]?.[k] || 0) },
      { label: GROUP_NAMES[3], type: 'group', groupNum: 3, getValue: (k) => groupTotals[3]?.[k] || 0 },
      { label: GROUP_NAMES[4], type: 'group', groupNum: 4, getValue: (k) => groupTotals[4]?.[k] || 0 },
      { label: GROUP_NAMES[5], type: 'group', groupNum: 5, getValue: (k) => groupTotals[5]?.[k] || 0 },
      { label: '= Lucro Operacional', type: 'subtotal', getValue: (k) => {
        const recLiq = ((groupTotals[1]?.[k] || 0) - AJUSTE_RECEITAS) - (groupTotals[2]?.[k] || 0);
        return recLiq - (groupTotals[3]?.[k] || 0) - (groupTotals[4]?.[k] || 0) - (groupTotals[5]?.[k] || 0);
      }},
      { label: GROUP_NAMES[6], type: 'group', groupNum: 6, getValue: (k) => groupTotals[6]?.[k] || 0 },
      { label: GROUP_NAMES[7], type: 'group', groupNum: 7, getValue: (k) => groupTotals[7]?.[k] || 0 },
      { label: GROUP_NAMES[8], type: 'group', groupNum: 8, getValue: (k) => groupTotals[8]?.[k] || 0 },
      { label: GROUP_NAMES[9], type: 'group', groupNum: 9, getValue: (k) => groupTotals[9]?.[k] || 0 },
      { label: GROUP_NAMES[10], type: 'group', groupNum: 10, getValue: (k) => groupTotals[10]?.[k] || 0 },
      { label: GROUP_NAMES[11], type: 'group', groupNum: 11, getValue: (k) => groupTotals[11]?.[k] || 0 },
      { label: '= Resultado Líquido', type: 'total', getValue: (k) => {
        const receitas = (groupTotals[1]?.[k] || 0) - AJUSTE_RECEITAS;
        let totalDesp = 0;
        for (let g = 2; g <= 11; g++) totalDesp += (groupTotals[g]?.[k] || 0);
        return receitas - totalDesp;
      }},
    ];

    // Compute month totals (resultado liquido)
    months.forEach(m => {
      const key = format(m, 'yyyy-MM');
      const receitas = (groupTotals[1]?.[key] || 0) - AJUSTE_RECEITAS;
      let totalDesp = 0;
      for (let g = 2; g <= 11; g++) totalDesp += (groupTotals[g]?.[key] || 0);
      monthTotals[key] = receitas - totalDesp;
    });

    let runningBalance = 0;
    const finalBalance: Record<string, number> = {};
    months.forEach(m => {
      const key = format(m, 'yyyy-MM');
      runningBalance += monthTotals[key] || 0;
      finalBalance[key] = runningBalance;
    });

    return { groupTotals, monthTotals, dre, finalBalance };
  }, [transactions, months]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Projeção Caixa Nescon
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium sticky left-0 bg-background min-w-[260px]">Indicador</th>
              {months.map(m => (
                <th key={format(m, 'yyyy-MM')} className="text-right py-2 px-3 font-medium min-w-[120px]">
                  {format(m, 'MMM/yy', { locale: ptBR })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dre.map((row, idx) => {
              const isSubtotal = row.type === 'subtotal';
              const isTotal = row.type === 'total';
              const isRevenue = row.groupNum === 1;

              const rowClass = isTotal
                ? 'border-t-2 border-primary/20 bg-primary/10 font-bold'
                : isSubtotal
                ? 'border-b bg-muted/30 font-medium'
                : isRevenue
                ? 'border-b bg-green-50/50 dark:bg-green-950/20 font-medium'
                : 'border-b';

              const stickyBg = isTotal
                ? 'bg-primary/10'
                : isSubtotal
                ? 'bg-muted/30'
                : isRevenue
                ? 'bg-green-50/50 dark:bg-green-950/20'
                : 'bg-background';

              return (
                <tr key={idx} className={rowClass}>
                  <td className={`py-2 px-3 sticky left-0 ${stickyBg}`}>{row.label}</td>
                  {months.map(m => {
                    const key = format(m, 'yyyy-MM');
                    const val = row.getValue(key);
                    const colorClass = isRevenue
                      ? 'text-green-600'
                      : (isSubtotal || isTotal)
                      ? val >= 0 ? 'text-green-600' : 'text-red-600'
                      : val > 0 ? 'text-red-600' : 'text-muted-foreground';
                    return (
                      <td key={key} className={`text-right py-2 px-3 ${colorClass}`}>
                        {isRevenue ? formatCurrency(val) : (isSubtotal || isTotal) ? formatCurrency(val) : formatCurrency(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Saldo Acumulado */}
            <tr className="bg-primary/5 font-bold">
              <td className="py-2 px-3 sticky left-0 bg-primary/5">Saldo Acumulado</td>
              {months.map(m => {
                const key = format(m, 'yyyy-MM');
                const balance = finalBalance[key] || 0;
                return <td key={key} className={`text-right py-2 px-3 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(balance)}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// SUB-COMPONENT: NesconDashboardView (with adjustment)
// ============================================================
function NesconDashboardView({ transactions, isLoading, startDate, endDate }: { transactions: CashFlowTransaction[]; isLoading?: boolean; startDate?: string; endDate?: string }) {
  // ---- Contracts + Cora revenue triad ----
  const { data: nesconContracts } = useQuery({
    queryKey: ['nescon-contracts-revenue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('monthly_value, client_id, clients(document)')
        .eq('manager', 'nescon')
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
  });

  const contractRevenue = useMemo(() => {
    if (!nesconContracts) return { total: 0, cnpjs: [] as string[] };
    let total = 0;
    const cnpjs: string[] = [];
    nesconContracts.forEach((c: any) => {
      total += Number(c.monthly_value || 0);
      const doc = c.clients?.document;
      if (doc) cnpjs.push(doc.replace(/[^\d]/g, ''));
    });
    return { total, cnpjs };
  }, [nesconContracts]);

  // Derive period months from filter dates
  const filterMonths = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    return Math.max(1, differenceInMonths(e, s) + 1);
  }, [startDate, endDate]);

  const projectedRevenue = (contractRevenue.total - AJUSTE_RECEITAS) * filterMonths;

  // Query Cora boletos paid for these CNPJs within the period
  const { data: coraPaid } = useQuery({
    queryKey: ['nescon-cora-paid', contractRevenue.cnpjs, startDate, endDate],
    queryFn: async () => {
      if (contractRevenue.cnpjs.length === 0) return [];
      // Normalize CNPJs for matching
      const { data, error } = await supabase
        .from('cora_boletos')
        .select('cnpj, total_amount_cents, paid_at, competencia_mes, competencia_ano');
      if (error) throw error;
      // Filter in JS: PAID status + matching CNPJs + within date range
      return (data || []).filter((b: any) => {
        if (!b.paid_at) return false;
        const bCnpj = (b.cnpj || '').replace(/[^\d]/g, '');
        if (!contractRevenue.cnpjs.includes(bCnpj)) return false;
        if (startDate && endDate && b.competencia_ano && b.competencia_mes) {
          const bDate = new Date(b.competencia_ano, b.competencia_mes - 1);
          const sDate = parseISO(startDate);
          const eDate = parseISO(endDate);
          return bDate >= startOfMonth(sDate) && bDate <= endOfMonth(eDate);
        }
        return true;
      });
    },
    enabled: contractRevenue.cnpjs.length > 0,
  });

  const executedRevenue = useMemo(() => {
    if (!coraPaid || coraPaid.length === 0) return 0;
    const raw = coraPaid.reduce((sum: number, b: any) => sum + (Number(b.total_amount_cents || 0) / 100), 0);
    // Apply R$ 2,800 discount per month when Cora revenue exceeds threshold
    if (raw > CORA_THRESHOLD) {
      return raw - (AJUSTE_RECEITAS * filterMonths);
    }
    return raw;
  }, [coraPaid, filterMonths]);

  const adimplencia = projectedRevenue > 0 ? (executedRevenue / projectedRevenue) * 100 : 0;

  const topExpenses = useMemo(() => {
    const expenseMap: Record<string, { name: string; total: number; accountId: string }> = {};
    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const group = tx.account?.group_number;
      if (!group) return;
      const accountId = tx.account_id;
      const accountName = tx.account?.name || accountId;
      const value = Number(tx.expense || 0) + Number(tx.future_expense || 0);
      if (!expenseMap[accountId]) expenseMap[accountId] = { name: accountName, total: 0, accountId };
      expenseMap[accountId].total += value;
    });
    return Object.values(expenseMap).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [transactions]);

  const freeCashProjection = useMemo(() => {
    const monthMap: Record<string, { income: number; expense: number; hasGroup1: boolean }> = {};
    transactions.forEach(tx => {
      const group = tx.account?.group_number;
      if (!group) return;
      const monthKey = format(parseISO(tx.date), 'yyyy-MM');
      if (!monthMap[monthKey]) monthMap[monthKey] = { income: 0, expense: 0, hasGroup1: false };
      const incomeVal = Number(tx.income || 0) + Number(tx.future_income || 0);
      const expenseVal = Number(tx.expense || 0) + Number(tx.future_expense || 0);
      if (tx.type === 'income') {
        monthMap[monthKey].income += incomeVal;
        if (group === 1) monthMap[monthKey].hasGroup1 = true;
      } else {
        monthMap[monthKey].expense += expenseVal;
      }
    });

    // Apply adjustment to months with Group 1 revenue
    Object.keys(monthMap).forEach(key => {
      if (monthMap[key].hasGroup1) {
        monthMap[key].income -= AJUSTE_RECEITAS;
      }
    });

    const sortedMonths = Object.keys(monthMap).sort();
    let accumulated = 0;
    return sortedMonths.map(key => {
      const data = monthMap[key];
      const net = data.income - data.expense;
      accumulated += net;
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        month: format(date, 'MMM/yy', { locale: ptBR }),
        receitas: data.income,
        despesas: data.expense,
        liquido: net,
        acumulado: accumulated,
      };
    });
  }, [transactions]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Revenue Triad: Contracts vs Cora */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Receita Contratual (Prevista)</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(projectedRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(contractRevenue.total)}/mês × {filterMonths} {filterMonths === 1 ? 'mês' : 'meses'}
            </p>
            <p className="text-xs text-muted-foreground">
              {nesconContracts?.length || 0} contratos ativos
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Receita Recebida (Cora)</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(executedRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {coraPaid?.length || 0} boletos pagos no período
            </p>
          </CardContent>
        </Card>
        <Card className={adimplencia >= 80 ? 'border-green-200 dark:border-green-800' : adimplencia >= 50 ? 'border-amber-200 dark:border-amber-800' : 'border-red-200 dark:border-red-800'}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Adimplência</CardTitle>
            <CheckCircle className={`h-4 w-4 ${adimplencia >= 80 ? 'text-green-500' : adimplencia >= 50 ? 'text-amber-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${adimplencia >= 80 ? 'text-green-600' : adimplencia >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {adimplencia.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Diferença: {formatCurrency(projectedRevenue - executedRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Maiores Despesas por Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topExpenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma despesa encontrada no período.</p>
          ) : (
            <div className="space-y-3">
              {topExpenses.map((item, idx) => {
                const maxVal = topExpenses[0]?.total || 1;
                const pct = (item.total / maxVal) * 100;
                return (
                  <div key={item.accountId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[60%]">
                        <span className="text-muted-foreground mr-1">{item.accountId}</span>
                        {item.name}
                      </span>
                      <span className="font-medium text-destructive">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Projeção de Dinheiro Livre (Ajustado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {freeCashProjection.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem dados para projeção.</p>
          ) : (
            <>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={freeCashProjection}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : name === 'acumulado' ? 'Acumulado' : 'Líquido']} />
                    <Bar dataKey="receitas" fill="hsl(142, 76%, 36%)" radius={[2, 2, 0, 0]} name="receitas" />
                    <Bar dataKey="despesas" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} name="despesas" />
                    <Bar dataKey="acumulado" name="acumulado" radius={[2, 2, 0, 0]}>
                      {freeCashProjection.map((entry, index) => (
                        <Cell key={index} fill={entry.acumulado >= 0 ? 'hsl(210, 100%, 50%)' : 'hsl(0, 100%, 50%)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Mês</th>
                      <th className="text-right py-2 px-3 font-medium text-green-600">Receitas</th>
                      <th className="text-right py-2 px-3 font-medium text-red-600">Despesas</th>
                      <th className="text-right py-2 px-3 font-medium">Líquido</th>
                      <th className="text-right py-2 px-3 font-medium">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freeCashProjection.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{row.month}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(row.receitas)}</td>
                        <td className="py-2 px-3 text-right text-red-600">{formatCurrency(row.despesas)}</td>
                        <td className={`py-2 px-3 text-right font-medium ${row.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(row.liquido)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${row.acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(row.acumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Export sub-components for use in FinancialNesconPage
export { NesconSummaryCards, NesconDashboardView, NesconProjectionView };

// ============================================================
// MAIN COMPONENT: NesconCashFlowView (kept for backward compatibility)
// ============================================================
export function NesconCashFlowView() {
  const [subTab, setSubTab] = useState('dashboard');

  // Filtros do fluxo de caixa
  const [filters, setFilters] = useState<CashFlowFiltersValues>({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  // Filtros do dashboard
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilterValues>({
    startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfYear(new Date()), 'yyyy-MM-dd'),
  });

  // Projeção
  const [projectionStartDate, setProjectionStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [projectionMonths, setProjectionMonths] = useState(6);

  const { data: allCategoriesFlat } = useAccountCategoriesFlat();
  const { data: financialAccounts } = useFinancialAccounts();

  const categoriesFlat = useMemo(() => {
    if (!allCategoriesFlat) return allCategoriesFlat;
    return allCategoriesFlat.filter(c => c.group_number <= 11 && !c.id.startsWith('F'));
  }, [allCategoriesFlat]);
  const settleTransaction = useSettleTransaction();
  const deleteTransaction = useDeleteCashFlowTransaction();

  // Data for cash flow tab
  const { data: transactions, isLoading: loadingTransactions } = useCashFlowTransactions({
    startDate: filters.startDate,
    endDate: filters.endDate,
    accountId: filters.accountId,
    type: filters.type,
    financialAccountId: filters.financialAccountId,
    source: 'nescon',
  });
  const { data: rawSummary, isLoading: loadingSummary } = useCashFlowSummary(filters.startDate, filters.endDate, filters.financialAccountId, 'nescon');

  // Data for dashboard tab
  const { data: dashboardTransactions, isLoading: loadingDashboard } = useCashFlowTransactions({
    startDate: dashboardFilter.startDate,
    endDate: dashboardFilter.endDate,
    source: 'nescon',
  });

  // Data for projection tab
  const projectionEndDate = format(addMonths(startOfMonth(new Date(projectionStartDate)), projectionMonths), 'yyyy-MM-dd');
  const { data: projectionTransactions, isLoading: loadingProjection } = useCashFlowTransactions({
    startDate: projectionStartDate,
    endDate: projectionEndDate,
    source: 'nescon',
  });

  // Local filters on transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => {
      if (filters.groupNumber && tx.account?.group_number !== filters.groupNumber) return false;
      if (filters.financialAccountId && tx.financial_account_id !== filters.financialAccountId) return false;
      if (filters.status) {
        const hasFuture = (tx.type === 'income' ? tx.future_income : tx.future_expense) > 0;
        const hasExecuted = (tx.type === 'income' ? tx.income : tx.expense) > 0;
        if (filters.status === 'projected' && (!hasFuture || hasExecuted)) return false;
        if (filters.status === 'executed' && (!hasExecuted || hasFuture)) return false;
        if (filters.status === 'mixed' && !(hasFuture && hasExecuted)) return false;
      }
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        if (!tx.description.toLowerCase().includes(term) && !tx.value.toString().includes(term) && !tx.origin_destination?.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [transactions, filters.groupNumber, filters.financialAccountId, filters.status, filters.searchTerm]);

  // Recalculate summary with local filters
  const hasLocalFilters = filters.groupNumber || filters.status || filters.searchTerm;
  const summary = useMemo(() => {
    if (!hasLocalFilters) return rawSummary;
    if (!filteredTransactions.length) return rawSummary;
    const result: CashFlowSummary = {
      totalIncome: 0, totalExpense: 0, balance: 0,
      projectedIncome: 0, projectedExpense: 0,
      executedIncome: 0, executedExpense: 0, executedBalance: 0,
      transactionCount: filteredTransactions.length,
    };
    filteredTransactions.forEach(tx => {
      const income = Number(tx.income || 0);
      const expense = Number(tx.expense || 0);
      const futureIncome = Number(tx.future_income || 0);
      const futureExpense = Number(tx.future_expense || 0);
      result.executedIncome += income;
      result.executedExpense += expense;
      result.projectedIncome += futureIncome;
      result.projectedExpense += futureExpense;
      result.totalIncome += income + futureIncome;
      result.totalExpense += expense + futureExpense;
    });
    result.balance = result.totalIncome - result.totalExpense;
    result.executedBalance = result.executedIncome - result.executedExpense;
    return result;
  }, [hasLocalFilters, rawSummary, filteredTransactions]);

  const grandTotalProjectedExpense = useMemo(() => {
    if (!transactions) return undefined;
    return transactions.reduce((sum, tx) => sum + Number(tx.future_expense || 0), 0);
  }, [transactions]);

  const resetFilters = () => {
    setFilters({
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });
  };

  return (
    <div className="space-y-4">

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="gap-2">
            <Wallet className="h-4 w-4" />
            Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="projection" className="gap-2">
            <CalendarRange className="h-4 w-4" />
            Projeção
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <DashboardFilters onChange={setDashboardFilter} />
          <NesconDashboardView
            transactions={dashboardTransactions || []}
            isLoading={loadingDashboard}
          />
        </TabsContent>

        <TabsContent value="cash-flow" className="space-y-6 mt-4">
          <CashFlowFilters
            filters={filters}
            onFiltersChange={setFilters}
            accounts={categoriesFlat || []}
            financialAccounts={financialAccounts || []}
            onReset={resetFilters}
          />
          {summary && (
            <NesconSummaryCards summary={summary} isLoading={loadingSummary} totalProjectedExpense={grandTotalProjectedExpense} />
          )}
          <TransactionsTable
            transactions={filteredTransactions}
            isLoading={loadingTransactions}
            onSettle={(id) => settleTransaction.mutate(id)}
            onDelete={(id) => deleteTransaction.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="projection" className="space-y-6 mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input type="date" value={projectionStartDate} onChange={(e) => setProjectionStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Meses</Label>
                  <select value={projectionMonths} onChange={(e) => setProjectionMonths(Number(e.target.value))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses</option>
                    <option value={24}>24 meses</option>
                  </select>
                </div>
                <Button variant="outline" onClick={() => { setProjectionStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setProjectionMonths(6); }}>
                  Redefinir
                </Button>
              </div>
            </CardContent>
          </Card>
          <NesconProjectionView
            transactions={projectionTransactions || []}
            isLoading={loadingProjection}
            startDate={projectionStartDate}
            monthsToShow={projectionMonths}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
