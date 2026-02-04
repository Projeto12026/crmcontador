import { useState } from 'react';
import { useTransactions, useCategories, useCreateTransaction, useMarkAsPaid, useDeleteTransaction } from '@/hooks/useFinancial';
import { useClients } from '@/hooks/useClients';
import { TransactionFormData, TransactionType, FinancialStatus } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Plus, Check, Trash2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<FinancialStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  paid: { label: 'Pago', variant: 'default' },
  overdue: { label: 'Atrasado', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'secondary' },
};

export function FinancialPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransactionType>('income');

  const { data: transactions, isLoading } = useTransactions({ type: typeFilter });
  const { data: categories } = useCategories(typeFilter);
  const { data: clients } = useClients();
  const createTransaction = useCreateTransaction();
  const markAsPaid = useMarkAsPaid();
  const deleteTransaction = useDeleteTransaction();

  const [formData, setFormData] = useState<TransactionFormData>({
    client_id: '',
    category_id: '',
    type: 'income',
    description: '',
    amount: 0,
    due_date: '',
    notes: '',
  });

  const openNewDialog = (type: TransactionType) => {
    setFormData({
      client_id: '',
      category_id: '',
      type,
      description: '',
      amount: 0,
      due_date: '',
      notes: '',
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTransaction.mutateAsync(formData);
    setIsOpen(false);
  };

  const isOverdue = (dueDate: string, status: FinancialStatus) => {
    if (status !== 'pending') return false;
    return isAfter(new Date(), parseISO(dueDate));
  };

  const totals = {
    pending: transactions?.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0) || 0,
    paid: transactions?.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0) || 0,
    overdue: transactions?.filter(t => isOverdue(t.due_date, t.status)).reduce((sum, t) => sum + t.amount, 0) || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">Controle de receitas e despesas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewDialog('expense')}>
            <TrendingDown className="mr-2 h-4 w-4 text-red-500" />
            Nova Despesa
          </Button>
          <Button onClick={() => openNewDialog('income')}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Nova Receita
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-green-50 dark:bg-green-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.paid)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.pending)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.overdue)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType)}>
        <TabsList>
          <TabsTrigger value="income">Receitas</TabsTrigger>
          <TabsTrigger value="expense">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value={typeFilter} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma transação encontrada
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions?.map((transaction) => (
                      <TableRow 
                        key={transaction.id}
                        className={isOverdue(transaction.due_date, transaction.status) ? 'bg-red-50 dark:bg-red-950' : ''}
                      >
                        <TableCell className="font-medium">{transaction.description}</TableCell>
                        <TableCell>{transaction.client?.name || '-'}</TableCell>
                        <TableCell>
                          {transaction.category && (
                            <Badge 
                              style={{ 
                                backgroundColor: transaction.category.color || '#6366f1',
                                color: '#fff'
                              }}
                            >
                              {transaction.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.type === 'expense' && '-'}
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isOverdue(transaction.due_date, transaction.status) ? 'destructive' : statusConfig[transaction.status].variant}>
                            {isOverdue(transaction.due_date, transaction.status) ? 'Atrasado' : statusConfig[transaction.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {transaction.status === 'pending' && (
                              <Button variant="ghost" size="icon" onClick={() => markAsPaid.mutate(transaction.id)} title="Marcar como pago">
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => deleteTransaction.mutate(transaction.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formData.type === 'income' ? 'Nova Receita' : 'Nova Despesa'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Vencimento *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTransaction.isPending}>
                {createTransaction.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
