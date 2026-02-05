import { CashFlowTransaction } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Check, Trash2, Clock, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionsTableProps {
  transactions: CashFlowTransaction[];
  isLoading?: boolean;
  onSettle?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function TransactionsTable({ 
  transactions, 
  isLoading, 
  onSettle, 
  onDelete 
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
                <TableRow key={tx.id}>
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
