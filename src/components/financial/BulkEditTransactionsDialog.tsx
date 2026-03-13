import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CashFlowTransaction, TransactionType } from '@/types/crm';
import { AccountCategory } from '@/types/crm';

export type BulkUpdateStatus = 'projected' | 'executed' | 'mixed';

interface BulkEditTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: (changes: {
    date?: string;
    account_id?: string;
    value?: number;
    origin_destination?: string;
    description?: string;
    status?: BulkUpdateStatus;
  }) => void;
  accounts: AccountCategory[];
}

export function BulkEditTransactionsDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  accounts,
}: BulkEditTransactionsDialogProps) {
  const [changeDate, setChangeDate] = useState(false);
  const [changeAccount, setChangeAccount] = useState(false);
  const [changeValue, setChangeValue] = useState(false);
  const [changeOrigin, setChangeOrigin] = useState(false);
  const [changeDescription, setChangeDescription] = useState(false);
  const [changeStatus, setChangeStatus] = useState(false);

  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [origin, setOrigin] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<BulkUpdateStatus>('executed');

  const handleConfirm = () => {
    const changes: {
      date?: string;
      account_id?: string;
      value?: number;
      origin_destination?: string;
      description?: string;
      status?: BulkUpdateStatus;
    } = {};

    if (changeDate && date) changes.date = date;
    if (changeAccount && accountId) changes.account_id = accountId;
    if (changeValue && value) changes.value = parseFloat(value.replace(',', '.')) || 0;
    if (changeOrigin && origin.trim()) changes.origin_destination = origin.trim();
    if (changeDescription && description.trim()) changes.description = description.trim();
    if (changeStatus) changes.status = status;

    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }

    onConfirm(changes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edição em lote ({count} lançamento(s))</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Marque apenas os campos que deseja alterar. As mudanças serão aplicadas a todos os lançamentos selecionados.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Checkbox checked={changeDate} onCheckedChange={v => setChangeDate(!!v)} />
              <div className="space-y-1 flex-1">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  disabled={!changeDate}
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox checked={changeAccount} onCheckedChange={v => setChangeAccount(!!v)} />
              <div className="space-y-1 flex-1">
                <Label>Conta</Label>
                <Select
                  value={accountId}
                  onValueChange={v => setAccountId(v)}
                  disabled={!changeAccount}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox checked={changeValue} onCheckedChange={v => setChangeValue(!!v)} />
              <div className="space-y-1 flex-1">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  disabled={!changeValue}
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox checked={changeOrigin} onCheckedChange={v => setChangeOrigin(!!v)} />
              <div className="space-y-1 flex-1">
                <Label>Origem/Destino</Label>
                <Input
                  value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  disabled={!changeOrigin}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 sm:col-span-2">
              <Checkbox checked={changeDescription} onCheckedChange={v => setChangeDescription(!!v)} />
              <div className="space-y-1 flex-1">
                <Label>Descrição</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!changeDescription}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 sm:col-span-2">
              <Checkbox checked={changeStatus} onCheckedChange={v => setChangeStatus(!!v)} />
              <div className="space-y-1 flex-1">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={v => setStatus(v as BulkUpdateStatus)}
                  disabled={!changeStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="projected">Projetado</SelectItem>
                    <SelectItem value="executed">Realizado</SelectItem>
                    <SelectItem value="mixed">Parcial (projetado + realizado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Aplicar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

