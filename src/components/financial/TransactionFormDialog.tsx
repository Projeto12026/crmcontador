import { useState, useEffect } from 'react';
import {
  CashFlowTransaction,
  CashFlowTransactionFormData,
  TransactionType,
  AccountCategory,
  FinancialAccount,
  PaymentMethod,
  Classification,
  RecurrenceType,
} from '@/types/crm';
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
import { useCreditCards } from '@/hooks/useCreditCards';

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
  const getInitialFormData = (): CashFlowTransactionFormData => {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      due_date: today,
      account_id: '',
      description: '',
      value: 0,
      origin_destination: '',
      type,
      is_future: true,
      is_installment: false,
      installment_count: 2,
    };
  };

  const [formData, setFormData] = useState<CashFlowTransactionFormData>(getInitialFormData());
  const { data: creditCards } = useCreditCards();

  const selectedFinancialAccountName =
    financialAccounts.find((acc) => acc.id === formData.financial_account_id)?.name || '';

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (editingTransaction) {
      const futureValue = editingTransaction.type === 'income'
        ? (editingTransaction.future_income || 0)
        : (editingTransaction.future_expense || 0);
      const isFuture = futureValue > 0;

      setFormData({
        date: editingTransaction.date.split('T')[0],
        due_date: (editingTransaction.due_date || editingTransaction.date).slice(0, 10),
        paid_date: editingTransaction.paid_date || undefined,
        account_id: editingTransaction.account_id,
        description: editingTransaction.description,
        value: editingTransaction.value,
        origin_destination: editingTransaction.origin_destination,
        type: editingTransaction.type,
        is_future: isFuture,
        financial_account_id: editingTransaction.financial_account_id || undefined,
        client_id: editingTransaction.client_id || undefined,
        notes: editingTransaction.notes || undefined,
        payment_method: editingTransaction.payment_method ?? undefined,
        classification: editingTransaction.classification ?? undefined,
        recurrence_type: editingTransaction.recurrence_type ?? undefined,
        credit_card_id: editingTransaction.credit_card_id ?? undefined,
      });
    } else {
      setFormData(getInitialFormData());
    }
  }, [editingTransaction, type, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { 
      ...formData, 
      type: editingTransaction?.type || type,
      // Origem/Destino deve refletir a conta financeira escolhida.
      origin_destination: selectedFinancialAccountName || formData.origin_destination || formData.description,
    };
    onSubmit(submitData);
    setFormData(getInitialFormData());
  };

  // Usar o tipo real da transação ao editar
  const effectiveType = editingTransaction?.type || type;
  
  // Filtrar contas por tipo
  const filteredAccounts = accounts.filter(acc => {
    if (effectiveType === 'income') {
      return acc.group_number >= 1 && acc.group_number <= 4;
    } else {
      // Todas as contas de despesa (grupos 2+)
      return acc.group_number >= 2 || acc.group_number === 100 || acc.group_number === 200;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTransaction
              ? 'Editar Lançamento'
              : (type === 'income' ? 'Nova Receita' : 'Nova Despesa')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
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
              <Label htmlFor="due_date">Vencimento *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date || formData.date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
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
          
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={formData.payment_method || ''}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    payment_method: (v || undefined) as PaymentMethod | undefined,
                    credit_card_id: v === 'credit_card' ? formData.credit_card_id : undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Cartao de Credito</SelectItem>
                  <SelectItem value="debit">Debito</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Classificacao</Label>
              <Select
                value={formData.classification || ''}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    classification: (v || undefined) as Classification | undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="essencial">Essencial</SelectItem>
                  <SelectItem value="obrigatoria">Obrigatoria</SelectItem>
                  <SelectItem value="poderia_esperar">Poderia esperar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recorrencia</Label>
              <Select
                value={formData.recurrence_type || ''}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    recurrence_type: (v || undefined) as RecurrenceType | undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel">Variavel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.payment_method === 'credit_card' && (
            <div className="space-y-2">
              <Label>Cartao de Credito *</Label>
              <Select
                value={formData.credit_card_id || ''}
                onValueChange={(v) =>
                  setFormData({ ...formData, credit_card_id: v || undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cartao" />
                </SelectTrigger>
                <SelectContent>
                  {(creditCards || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.financial_account?.name}
                      {c.brand ? ` · ${c.brand}` : ''}
                      {' · '}Fech. {c.closing_day} / Venc. {c.due_day}
                    </SelectItem>
                  ))}
                  {(!creditCards || creditCards.length === 0) && (
                    <SelectItem value="" disabled>
                      Nenhum cartao cadastrado — crie um na aba &quot;Cartoes&quot;
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A fatura sera calculada automaticamente pelo dia de fechamento do cartao.
              </p>
            </div>
          )}

          <div className="space-y-3 py-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <Switch
                id="is_future"
                checked={formData.is_future}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    is_future: checked,
                    paid_date: checked ? undefined : formData.paid_date,
                  })
                }
              />
              <Label htmlFor="is_future" className="cursor-pointer">
                Em aberto (projetado)
              </Label>
              {!formData.is_future && (
                <div className="flex items-center gap-2 ml-4">
                  <Label htmlFor="paid_date" className="text-xs">
                    Baixado em
                  </Label>
                  <Input
                    id="paid_date"
                    type="date"
                    value={formData.paid_date || formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, paid_date: e.target.value })
                    }
                    className="h-8"
                  />
                </div>
              )}
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
                Valor total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.value * (formData.installment_count || 2))}
                {' '}({formData.installment_count || 2}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.value)})
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
