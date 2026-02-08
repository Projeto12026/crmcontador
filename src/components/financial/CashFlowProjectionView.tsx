import { useMemo } from 'react';
import { CashFlowTransaction, ACCOUNT_GROUPS, EXCLUDED_ACCOUNT_GROUPS } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, addMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CashFlowProjectionViewProps {
  transactions: CashFlowTransaction[];
  isLoading?: boolean;
  startDate: string;
  monthsToShow?: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface MonthData {
  projected: number;
  executed: number;
  total: number;
}

interface AccountRow {
  id: string;
  name: string;
  groupNumber: number;
  months: Record<string, MonthData>;
  isGroup?: boolean;
}

export function CashFlowProjectionView({ 
  transactions, 
  isLoading,
  startDate,
  monthsToShow = 6,
}: CashFlowProjectionViewProps) {
  // Gerar lista de meses para exibição
  const months = useMemo(() => {
    const result: Date[] = [];
    const start = startOfMonth(parseISO(startDate));
    for (let i = 0; i < monthsToShow; i++) {
      result.push(addMonths(start, i));
    }
    return result;
  }, [startDate, monthsToShow]);

  // Processar transações em estrutura de linhas
  const { rows, monthTotals, finalBalance } = useMemo(() => {
    const accountMap: Record<string, AccountRow> = {};
    const monthTotals: Record<string, MonthData> = {};
    
    // Inicializar totais por mês
    months.forEach(m => {
      const key = format(m, 'yyyy-MM');
      monthTotals[key] = { projected: 0, executed: 0, total: 0 };
    });

    transactions.forEach(tx => {
      const txDate = parseISO(tx.date);
      const monthKey = format(txDate, 'yyyy-MM');
      
      // Verificar se está dentro do período
      if (!months.some(m => isSameMonth(m, txDate))) return;
      
      // Excluir grupos 7 e 8 do cálculo
      const group = tx.account?.group_number;
      if (!group || group > 6 || EXCLUDED_ACCOUNT_GROUPS.has(group)) return;

      const accountId = tx.account_id;
      const accountName = tx.account?.name || accountId;

      if (!accountMap[accountId]) {
        accountMap[accountId] = {
          id: accountId,
          name: accountName,
          groupNumber: group,
          months: {},
        };
        months.forEach(m => {
          accountMap[accountId].months[format(m, 'yyyy-MM')] = { projected: 0, executed: 0, total: 0 };
        });
      }

      const futureValue = tx.type === 'income' ? (tx.future_income || 0) : (tx.future_expense || 0);
      const executedValue = tx.type === 'income' ? (tx.income || 0) : (tx.expense || 0);
      const sign = tx.type === 'income' ? 1 : -1;

      if (accountMap[accountId].months[monthKey]) {
        accountMap[accountId].months[monthKey].projected += futureValue * sign;
        accountMap[accountId].months[monthKey].executed += executedValue * sign;
        accountMap[accountId].months[monthKey].total += (futureValue + executedValue) * sign;
      }

      if (monthTotals[monthKey]) {
        monthTotals[monthKey].projected += futureValue * sign;
        monthTotals[monthKey].executed += executedValue * sign;
        monthTotals[monthKey].total += (futureValue + executedValue) * sign;
      }
    });

    // Ordenar linhas por ID da conta
    const rows = Object.values(accountMap).sort((a, b) => a.id.localeCompare(b.id));

    // Calcular saldo acumulado
    let runningBalance = 0;
    const finalBalance: Record<string, number> = {};
    months.forEach(m => {
      const key = format(m, 'yyyy-MM');
      runningBalance += monthTotals[key]?.total || 0;
      finalBalance[key] = runningBalance;
    });

    return { rows, monthTotals, finalBalance };
  }, [transactions, months]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projeção de Fluxo de Caixa</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium sticky left-0 bg-background min-w-[200px]">
                Conta
              </th>
              {months.map(m => (
                <th key={format(m, 'yyyy-MM')} className="text-right py-2 px-3 font-medium min-w-[120px]">
                  {format(m, 'MMM/yy', { locale: ptBR })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b hover:bg-muted/50">
                <td className="py-2 px-3 sticky left-0 bg-background">
                  <span className="text-muted-foreground text-xs">{row.id}</span>
                  <span className="ml-2">{row.name}</span>
                </td>
                {months.map(m => {
                  const key = format(m, 'yyyy-MM');
                  const data = row.months[key] || { total: 0, projected: 0, executed: 0 };
                  const hasProjected = data.projected !== 0;
                  const hasExecuted = data.executed !== 0;
                  
                  return (
                    <td key={key} className="text-right py-2 px-3">
                      {data.total !== 0 && (
                        <div className={data.total > 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(Math.abs(data.total))}
                          {hasProjected && !hasExecuted && (
                            <span className="text-xs text-blue-500 ml-1">(P)</span>
                          )}
                          {hasProjected && hasExecuted && (
                            <span className="text-xs text-yellow-500 ml-1">(M)</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* Linha de Total do Mês */}
            <tr className="border-t-2 border-primary/20 bg-muted/30 font-medium">
              <td className="py-2 px-3 sticky left-0 bg-muted/30">
                Resultado do Mês
              </td>
              {months.map(m => {
                const key = format(m, 'yyyy-MM');
                const total = monthTotals[key]?.total || 0;
                return (
                  <td key={key} className={`text-right py-2 px-3 ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(total)}
                  </td>
                );
              })}
            </tr>
            
            {/* Linha de Saldo Acumulado */}
            <tr className="bg-primary/10 font-bold">
              <td className="py-2 px-3 sticky left-0 bg-primary/10">
                Saldo Acumulado
              </td>
              {months.map(m => {
                const key = format(m, 'yyyy-MM');
                const balance = finalBalance[key] || 0;
                return (
                  <td key={key} className={`text-right py-2 px-3 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(balance)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        
        <div className="mt-4 text-xs text-muted-foreground">
          <span className="text-blue-500">(P)</span> = Projetado | 
          <span className="text-yellow-500 ml-2">(M)</span> = Misto (projetado + realizado)
        </div>
      </CardContent>
    </Card>
  );
}
