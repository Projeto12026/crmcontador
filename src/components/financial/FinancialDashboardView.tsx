import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingDown, Clock, Wallet } from 'lucide-react';
import { CashFlowTransaction, EXCLUDED_ACCOUNT_GROUPS } from '@/types/crm';
import { format, parseISO, startOfMonth, addMonths, isSameMonth, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancialDashboardViewProps {
  transactions: CashFlowTransaction[];
  isLoading?: boolean;
}

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

/**
 * Detect installment groups by matching description patterns like "Descrição (1/6)", "Descrição (2/6)" etc.
 */
function detectInstallmentGroups(transactions: CashFlowTransaction[]) {
  const installmentPattern = /^(.+?)\s*\((\d+)\/(\d+)\)$/;
  const groups: Record<string, {
    baseName: string;
    totalInstallments: number;
    transactions: CashFlowTransaction[];
    totalValue: number;
    firstDate: string;
    lastDate: string;
  }> = {};

  transactions.forEach(tx => {
    if (tx.type !== 'expense') return;
    const group = tx.account?.group_number;
    if (!group || group > 6 || EXCLUDED_ACCOUNT_GROUPS.has(group)) return;
    const match = tx.description.match(installmentPattern);
    if (!match) return;

    const baseName = match[1].trim();
    const total = parseInt(match[3]);
    const key = `${baseName}__${total}__${tx.account_id}`;

    if (!groups[key]) {
      groups[key] = {
        baseName,
        totalInstallments: total,
        transactions: [],
        totalValue: 0,
        firstDate: tx.date,
        lastDate: tx.date,
      };
    }

    groups[key].transactions.push(tx);
    const value = Number(tx.expense || 0) + Number(tx.future_expense || 0);
    groups[key].totalValue += value;

    if (tx.date < groups[key].firstDate) groups[key].firstDate = tx.date;
    if (tx.date > groups[key].lastDate) groups[key].lastDate = tx.date;
  });

  return Object.values(groups)
    .filter(g => g.totalInstallments > 1)
    .sort((a, b) => {
      // Sort by latest last date (most distant installments first)
      if (b.lastDate !== a.lastDate) return b.lastDate.localeCompare(a.lastDate);
      return b.totalValue - a.totalValue;
    });
}

export function FinancialDashboardView({ transactions, isLoading }: FinancialDashboardViewProps) {
  // 1. Top expenses by account category
  const topExpenses = useMemo(() => {
    const expenseMap: Record<string, { name: string; total: number; accountId: string }> = {};

    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const group = tx.account?.group_number;
      if (!group || group > 6 || EXCLUDED_ACCOUNT_GROUPS.has(group)) return;

      const accountId = tx.account_id;
      const accountName = tx.account?.name || accountId;
      const value = Number(tx.expense || 0) + Number(tx.future_expense || 0);

      if (!expenseMap[accountId]) {
        expenseMap[accountId] = { name: accountName, total: 0, accountId };
      }
      expenseMap[accountId].total += value;
    });

    return Object.values(expenseMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [transactions]);

  // 2. Installment groups with most distant payments
  const installmentGroups = useMemo(() => {
    return detectInstallmentGroups(transactions).slice(0, 10);
  }, [transactions]);

  // 3. Free cash projection (accumulated balance per month, excluding groups 7, 8, 100+)
  const freeCashProjection = useMemo(() => {
    const monthMap: Record<string, { income: number; expense: number }> = {};

    transactions.forEach(tx => {
      const group = tx.account?.group_number;
      if (!group || group > 6 || EXCLUDED_ACCOUNT_GROUPS.has(group)) return;

      const monthKey = format(parseISO(tx.date), 'yyyy-MM');

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { income: 0, expense: 0 };
      }

      const incomeVal = Number(tx.income || 0) + Number(tx.future_income || 0);
      const expenseVal = Number(tx.expense || 0) + Number(tx.future_expense || 0);

      if (tx.type === 'income') {
        monthMap[monthKey].income += incomeVal;
      } else {
        monthMap[monthKey].expense += expenseVal;
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Expenses Chart */}
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
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: COLORS[idx % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installment Groups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Despesas Parceladas (Mais Longínquas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {installmentGroups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma despesa parcelada encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Descrição</th>
                    <th className="text-center py-2 px-3 font-medium">Parcelas</th>
                    <th className="text-right py-2 px-3 font-medium">Valor Total</th>
                    <th className="text-right py-2 px-3 font-medium">Primeira</th>
                    <th className="text-right py-2 px-3 font-medium">Última</th>
                    <th className="text-center py-2 px-3 font-medium">Meses Restantes</th>
                  </tr>
                </thead>
                <tbody>
                  {installmentGroups.map((group, idx) => {
                    const now = new Date();
                    const lastDate = parseISO(group.lastDate);
                    const monthsRemaining = differenceInMonths(lastDate, now);

                    return (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">{group.baseName}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {group.transactions.length}/{group.totalInstallments}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-destructive">
                          {formatCurrency(group.totalValue)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {format(parseISO(group.firstDate), 'MMM/yy', { locale: ptBR })}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {format(lastDate, 'MMM/yy', { locale: ptBR })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`font-medium ${monthsRemaining > 6 ? 'text-orange-500' : monthsRemaining > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                            {monthsRemaining > 0 ? `${monthsRemaining} meses` : 'Finalizado'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Free Cash Projection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Projeção de Dinheiro Livre
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
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : name === 'acumulado' ? 'Acumulado' : 'Líquido',
                      ]}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
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

              {/* Summary table */}
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
                        <td className={`py-2 px-3 text-right font-medium ${row.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(row.liquido)}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${row.acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(row.acumulado)}
                        </td>
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
