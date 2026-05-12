import { useMemo } from 'react';
import { CashFlowTransaction, EXCLUDED_ACCOUNT_GROUPS } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarClock, TrendingDown } from 'lucide-react';
import { format, parseISO, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InstallmentExpensesViewProps {
  transactions: CashFlowTransaction[];
  isLoading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface InstallmentGroup {
  baseDescription: string;
  accountId: string;
  accountName: string;
  value: number;
  dayOfMonth: number;
  totalInstallments: number;
  remainingInstallments: number;
  paidInstallments: number;
  firstDate: Date;
  lastDate: Date;
  totalRemaining: number;
  totalPaid: number;
  totalValue: number;
  transactions: CashFlowTransaction[];
}

/**
 * Strips installment suffix like " (3/12)" from description
 */
function getBaseDescription(description: string): string {
  return description.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
}

/**
 * Checks if all values in array are the same (fixed day)
 */
function hasFixedDay(days: number[]): boolean {
  if (days.length < 2) return false;
  return days.every(d => d === days[0]);
}

export function InstallmentExpensesView({ transactions, isLoading }: InstallmentExpensesViewProps) {
  const installmentGroups = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    // Only expense transactions, excluding administrative groups
    const expenses = transactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const group = tx.account?.group_number;
      if (group && (group > 6 || EXCLUDED_ACCOUNT_GROUPS.has(group))) return false;
      return true;
    });

    // Group by base description + account_id + value
    const groupMap = new Map<string, CashFlowTransaction[]>();

    for (const tx of expenses) {
      const baseDesc = getBaseDescription(tx.description);
      const key = `${baseDesc}|${tx.account_id}|${tx.value}`;
      
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(tx);
    }

    // Filter: must have 2+ transactions with fixed day of month
    const groups: InstallmentGroup[] = [];
    const today = new Date();

    for (const [, txs] of groupMap) {
      if (txs.length < 2) continue;

      const sortedTxs = [...txs].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const days = sortedTxs.map(tx => parseISO(tx.date).getDate());
      if (!hasFixedDay(days)) continue;

      const firstDate = parseISO(sortedTxs[0].date);
      const lastDate = parseISO(sortedTxs[sortedTxs.length - 1].date);
      
      const futureTxs = sortedTxs.filter(tx => {
        const futureExpense = Number(tx.future_expense || 0);
        return futureExpense > 0;
      });
      
      const paidTxs = sortedTxs.filter(tx => {
        const expense = Number(tx.expense || 0);
        return expense > 0;
      });

      const baseDesc = getBaseDescription(sortedTxs[0].description);
      const value = Number(sortedTxs[0].value);

      groups.push({
        baseDescription: baseDesc,
        accountId: sortedTxs[0].account_id,
        accountName: sortedTxs[0].account?.name || sortedTxs[0].account_id,
        value,
        dayOfMonth: days[0],
        totalInstallments: sortedTxs.length,
        remainingInstallments: futureTxs.length,
        paidInstallments: paidTxs.length,
        firstDate,
        lastDate,
        totalRemaining: futureTxs.reduce((sum, tx) => sum + Number(tx.future_expense || 0), 0),
        totalPaid: paidTxs.reduce((sum, tx) => sum + Number(tx.expense || 0), 0),
        totalValue: sortedTxs.reduce((sum, tx) => sum + Number(tx.value), 0),
        transactions: sortedTxs,
      });
    }

    // Sort by furthest last date (most distant first)
    groups.sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());

    return groups;
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (installmentGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma despesa parcelada identificada no período.
        </CardContent>
      </Card>
    );
  }

  const totalRemaining = installmentGroups.reduce((sum, g) => sum + g.totalRemaining, 0);
  const totalAll = installmentGroups.reduce((sum, g) => sum + g.totalValue, 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              Grupos de Parcelas
            </div>
            <p className="text-2xl font-bold mt-1">{installmentGroups.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              Total a Pagar (Futuro)
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(totalRemaining)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Valor Total Comprometido</div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalAll)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Installment groups table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Despesas Parceladas (Mais Longínquas)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium">Descrição</th>
                <th className="text-left py-3 px-4 font-medium">Conta</th>
                <th className="text-right py-3 px-4 font-medium">Valor/Parcela</th>
                <th className="text-center py-3 px-4 font-medium">Dia</th>
                <th className="text-center py-3 px-4 font-medium">Parcelas</th>
                <th className="text-right py-3 px-4 font-medium">Pago</th>
                <th className="text-right py-3 px-4 font-medium">A Pagar</th>
                <th className="text-left py-3 px-4 font-medium">Primeira</th>
                <th className="text-left py-3 px-4 font-medium">Última</th>
                <th className="text-center py-3 px-4 font-medium">Meses Restantes</th>
              </tr>
            </thead>
            <tbody>
              {installmentGroups.map((group, idx) => {
                const monthsLeft = Math.max(0, differenceInMonths(group.lastDate, new Date()));
                const progress = group.totalInstallments > 0 
                  ? (group.paidInstallments / group.totalInstallments) * 100 
                  : 0;

                return (
                  <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{group.baseDescription}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-muted-foreground">{group.accountId}</span>
                      <br />
                      <span>{group.accountName}</span>
                    </td>
                    <td className="text-right py-3 px-4 text-red-600 font-mono">
                      {formatCurrency(group.value)}
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge variant="outline">dia {group.dayOfMonth}</Badge>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">
                          {group.paidInstallments}/{group.totalInstallments}
                        </span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-green-600 font-mono">
                      {formatCurrency(group.totalPaid)}
                    </td>
                    <td className="text-right py-3 px-4 text-red-600 font-mono font-medium">
                      {formatCurrency(group.totalRemaining)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {format(group.firstDate, 'MM/yyyy')}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {format(group.lastDate, 'MM/yyyy')}
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge 
                        variant={monthsLeft > 12 ? "destructive" : monthsLeft > 6 ? "secondary" : "outline"}
                      >
                        {monthsLeft} {monthsLeft === 1 ? 'mês' : 'meses'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/30 font-medium">
                <td colSpan={5} className="py-3 px-4 text-right">Totais:</td>
                <td className="text-right py-3 px-4 text-green-600 font-mono">
                  {formatCurrency(installmentGroups.reduce((s, g) => s + g.totalPaid, 0))}
                </td>
                <td className="text-right py-3 px-4 text-red-600 font-mono font-bold">
                  {formatCurrency(totalRemaining)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
