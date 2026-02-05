import { useState, useEffect } from 'react';
import { CashFlowTransaction, CashFlowTransactionFormData, TransactionType, AccountCategory, FinancialAccount } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Client } from '@/types/crm';

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CashFlowTransactionFormData) => void;
  isPending?: boolean;
  type?: TransactionType;
  accounts: AccountCategory[];
  financialAccounts: FinancialAccount[];
  clients?: Client[];
  editingTransaction?: CashFlowTransaction | null;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  type = 'income',
  accounts,
  financialAccounts,
  clients = [],
  editingTransaction,
}: TransactionFormDialogProps) {
  const getInitialFormData = (): CashFlowTransactionFormData => ({
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    description: '',
    value: 0,
    origin_destination: '',
    type,
    is_future: false,
    is_installment: false,
    installment_count: 2,
  });

  const [formData, setFormData] = useState<CashFlowTransactionFormData>(getInitialFormData());

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (editingTransaction) {
      const futureValue = editingTransaction.type === 'income' 
        ? (editingTransaction.future_income || 0) 
        : (editingTransaction.future_expense || 0);
      const isFuture = futureValue > 0;
      
      setFormData({
        date: editingTransaction.date.split('T')[0],
        account_id: editingTransaction.account_id,
        description: editingTransaction.description,
        value: editingTransaction.value,
        origin_destination: editingTransaction.origin_destination,
        type: editingTransaction.type,
        is_future: isFuture,
        financial_account_id: editingTransaction.financial_account_id || undefined,
        client_id: editingTransaction.client_id || undefined,
        notes: editingTransaction.notes || undefined,
      });
    } else {
      setFormData(getInitialFormData());
    }
  }, [editingTransaction, type, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, type: editingTransaction?.type || type });
    setFormData(getInitialFormData());
  };

  // Filtrar contas por tipo (grupos 1-4 para receitas, 5-6 para despesas)
  const filteredAccounts = accounts.filter(acc => {
    if (type === 'income') {
      return acc.group_number >= 1 && acc.group_number <= 4;
    } else {
      return acc.group_number >= 5 && acc.group_number <= 6;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingTransaction 
              ? 'Editar Lançamento' 
              : (type === 'income' ? 'Nova Receita' : 'Nova Despesa')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Valor *</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.value || ''}
                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Conta do Plano de Contas *</Label>
            <Select 
              value={formData.account_id} 
              onValueChange={(v) => setFormData({ ...formData, account_id: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.id} - {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="origin_destination">
              {type === 'income' ? 'Origem' : 'Destino'} *
            </Label>
            <Input
              id="origin_destination"
              value={formData.origin_destination}
              onChange={(e) => setFormData({ ...formData, origin_destination: e.target.value })}
              placeholder={type === 'income' ? 'De onde vem o valor' : 'Para onde vai o valor'}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta Financeira</Label>
              <Select 
                value={formData.financial_account_id || ''} 
                onValueChange={(v) => setFormData({ ...formData, financial_account_id: v || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {financialAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select 
                value={formData.client_id || ''} 
                onValueChange={(v) => setFormData({ ...formData, client_id: v || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-3 py-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <Switch
                id="is_future"
                checked={formData.is_future}
                onCheckedChange={(checked) => setFormData({ ...formData, is_future: checked })}
              />
              <Label htmlFor="is_future" className="cursor-pointer">
                Valor projetado (futuro)
              </Label>
            </div>
            
            <div className="flex items-center gap-3">
              <Switch
                id="is_installment"
                checked={formData.is_installment}
                onCheckedChange={(checked) => setFormData({ ...formData, is_installment: checked })}
                disabled={!!editingTransaction}
              />
              <Label htmlFor="is_installment" className="cursor-pointer">
                Parcelado
              </Label>
              {formData.is_installment && (
                <div className="flex items-center gap-2 ml-4">
                  <Input
                    type="number"
                    min="2"
                    max="60"
                    value={formData.installment_count || 2}
                    onChange={(e) => setFormData({ ...formData, installment_count: Number(e.target.value) })}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">parcelas</span>
                </div>
              )}
            </div>
            
            {formData.is_installment && formData.value > 0 && (
              <p className="text-sm text-muted-foreground">
                Valor por parcela: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.value / (formData.installment_count || 2))}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
