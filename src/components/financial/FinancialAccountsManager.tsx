import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Plus, Pencil, Trash2, Loader2, CreditCard, Banknote, Landmark, RefreshCw } from 'lucide-react';
import { FinancialAccount, FinancialAccountFormData, FinancialAccountType } from '@/types/crm';
import {
  useFinancialAccounts,
  useCreateFinancialAccount,
  useUpdateFinancialAccount,
  useDeleteFinancialAccount,
  useRecalculateBalance,
} from '@/hooks/useFinancialAccounts';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  bank: 'Banco',
  cash: 'Caixa',
  credit: 'Cartão de Crédito',
};

const ACCOUNT_TYPE_ICONS: Record<FinancialAccountType, typeof Landmark> = {
  bank: Landmark,
  cash: Banknote,
  credit: CreditCard,
};

export function FinancialAccountsManager() {
  const { data: accounts, isLoading } = useFinancialAccounts();
  const createAccount = useCreateFinancialAccount();
  const updateAccount = useUpdateFinancialAccount();
  const deleteAccount = useDeleteFinancialAccount();
  const recalculateBalance = useRecalculateBalance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<FinancialAccount | null>(null);

  const [formData, setFormData] = useState<FinancialAccountFormData>({
    name: '',
    type: 'bank',
    initial_balance: 0,
  });

  const openNew = () => {
    setEditingAccount(null);
    setFormData({ name: '', type: 'bank', initial_balance: 0 });
    setDialogOpen(true);
  };

  const openEdit = (account: FinancialAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      initial_balance: account.initial_balance,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingAccount) {
      updateAccount.mutate(
        { id: editingAccount.id, data: formData },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createAccount.mutate(formData, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDelete = (account: FinancialAccount) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      deleteAccount.mutate(accountToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setAccountToDelete(null);
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = {
    bank: accounts?.filter(a => a.type === 'bank') || [],
    cash: accounts?.filter(a => a.type === 'cash') || [],
    credit: accounts?.filter(a => a.type === 'credit') || [],
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contas Financeiras</CardTitle>
          <Button onClick={openNew} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {(Object.keys(grouped) as FinancialAccountType[]).map(type => {
            const list = grouped[type];
            if (list.length === 0) return null;
            const Icon = ACCOUNT_TYPE_ICONS[type];

            return (
              <div key={type} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <Icon className="h-4 w-4" />
                  {ACCOUNT_TYPE_LABELS[type]}
                </h3>
                <div className="grid gap-2">
                  {list.map(account => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Saldo inicial: {formatCurrency(account.initial_balance)} · 
                          Saldo atual: <span className={account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(account.current_balance)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => recalculateBalance.mutate(account.id)}
                          title="Recalcular saldo"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(account)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {(!accounts || accounts.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma conta financeira cadastrada</p>
              <Button variant="outline" className="mt-4" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeira conta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta Financeira'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-name">Nome</Label>
              <Input
                id="account-name"
                placeholder="Ex: CC Inter, Caixa, Nubank..."
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={v => setFormData(prev => ({ ...prev, type: v as FinancialAccountType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Banco</SelectItem>
                  <SelectItem value="cash">Caixa</SelectItem>
                  <SelectItem value="credit">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="initial-balance">Saldo Inicial</Label>
              <Input
                id="initial-balance"
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={e => setFormData(prev => ({ ...prev, initial_balance: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createAccount.isPending || updateAccount.isPending}
            >
              {(createAccount.isPending || updateAccount.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingAccount ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de exclusão */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Excluir conta financeira"
        description={`Tem certeza que deseja excluir "${accountToDelete?.name}"? Transações vinculadas não serão excluídas.`}
        isPending={deleteAccount.isPending}
      />
    </>
  );
}
