import { CashFlowTransaction } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Check, Trash2, Clock, Loader2, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionsTableProps {
  transactions: CashFlowTransaction[];
  isLoading?: boolean;
  onSettle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (transaction: CashFlowTransaction) => void;
  showExport?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function exportToExcel(transactions: CashFlowTransaction[]) {
  const BOM = '\uFEFF';
  const SEP = ';';
  const headers = ['Data', 'Conta ID', 'Conta', 'Descrição', 'Origem/Destino', 'Tipo', 'Projetado', 'Realizado', 'Status'];
  
  const rows = transactions.map(tx => {
    const futureValue = tx.type === 'income' ? (tx.future_income || 0) : (tx.future_expense || 0);
    const executedValue = tx.type === 'income' ? (tx.income || 0) : (tx.expense || 0);
    const hasFuture = futureValue > 0;
    const hasExecuted = executedValue > 0;
    const status = hasFuture && !hasExecuted ? 'Projetado' : hasFuture && hasExecuted ? 'Parcial' : 'Realizado';
    
    return [
      format(parseISO(tx.date), 'dd/MM/yyyy', { locale: ptBR }),
      tx.account_id,
      tx.account?.name || '',
      tx.description,
      tx.origin_destination || '',
      tx.type === 'income' ? 'Receita' : 'Despesa',
      futureValue.toFixed(2).replace('.', ','),
      executedValue.toFixed(2).replace('.', ','),
      status,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(SEP);
  });

  const csv = BOM + headers.join(SEP) + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fluxo-caixa-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TransactionsTable({ 
  transactions, 
  isLoading, 
  onSettle, 
  onDelete,
  onEdit,
  showExport = false,
}: TransactionsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum lançamento encontrado
      </div>
    );
  }

  return (
    <Card>
      {showExport && transactions.length > 0 && (
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{transactions.length} lançamento(s)</CardTitle>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(transactions)}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Origem/Destino</TableHead>
              <TableHead className="text-right">Projetado</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const futureValue = tx.type === 'income' ? tx.future_income : tx.future_expense;
              const executedValue = tx.type === 'income' ? tx.income : tx.expense;
              const hasFuture = (futureValue || 0) > 0;
              const hasExecuted = (executedValue || 0) > 0;

              return (
                <TableRow 
                  key={tx.id} 
                  className="cursor-pointer"
                  onDoubleClick={() => onEdit?.(tx)}
                >
                  <TableCell>
                    {format(parseISO(tx.date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{tx.account_id}</span>
                    <br />
                    <span className="text-sm">{tx.account?.name}</span>
                  </TableCell>
                  <TableCell className="font-medium">{tx.description}</TableCell>
                  <TableCell>{tx.origin_destination}</TableCell>
                  <TableCell className="text-right">
                    {hasFuture && (
                      <span className="text-blue-600">
                        {tx.type === 'expense' && '-'}
                        {formatCurrency(futureValue || 0)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasExecuted && (
                      <span className={tx.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {tx.type === 'expense' && '-'}
                        {formatCurrency(executedValue || 0)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasFuture && !hasExecuted ? (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Projetado
                      </Badge>
                    ) : hasFuture && hasExecuted ? (
                      <Badge variant="secondary">Parcial</Badge>
                    ) : (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Realizado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {hasFuture && onSettle && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onSettle(tx.id)}
                          title="Liquidar valor futuro"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onDelete(tx.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
