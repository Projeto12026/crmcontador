import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, CreditCard as CreditCardIcon, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { CreditCard, CreditCardFormData } from '@/types/crm';
import {
  useCreditCards,
  useCreateCreditCard,
  useUpdateCreditCard,
  useDeleteCreditCard,
  useCreditCardUsage,
} from '@/hooks/useCreditCards';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FINANCE_DB_USER_HINT, FINANCE_DB_LOCAL_SCHEMA_HINT } from '@/lib/postgrest-errors';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface CreditCardManagerProps {
  onSelectCard?: (card: CreditCard) => void;
  selectedCardId?: string | null;
}

export function CreditCardManager({ onSelectCard, selectedCardId }: CreditCardManagerProps) {
  const { toast } = useToast();
  const { data: cards, isLoading, schemaMissing, financeDbIssue } = useCreditCards();
  const { data: financialAccounts } = useFinancialAccounts();
  const createCard = useCreateCreditCard();
  const updateCard = useUpdateCreditCard();
  const deleteCard = useDeleteCreditCard();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountComboOpen, setAccountComboOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  const [formData, setFormData] = useState<CreditCardFormData>({
    name: '',
    brand: '',
    credit_limit: 0,
    closing_day: 1,
    due_day: 10,
    color: '#1f2937',
    financial_account_id: null,
  });

  const usedFinancialAccountIds = useMemo(() => {
    return new Set(
      (cards || []).filter((c) => !editingCard || c.id !== editingCard.id).map((c) => c.financial_account_id),
    );
  }, [cards, editingCard]);

  const allCreditAccounts = useMemo(() => {
    return (financialAccounts || [])
      .filter((a) => a.type === 'credit')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [financialAccounts]);

  const isFaTakenByOtherCard = (faId: string) =>
    usedFinancialAccountIds.has(faId) && faId !== formData.financial_account_id;

  const openNew = () => {
    setEditingCard(null);
    setAccountComboOpen(false);
    setFormData({
      name: '',
      brand: '',
      credit_limit: 0,
      closing_day: 1,
      due_day: 10,
      color: '#1f2937',
      financial_account_id: null,
    });
    setDialogOpen(true);
  };

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setAccountComboOpen(false);
    setFormData({
      name: card.financial_account?.name || '',
      brand: card.brand || '',
      credit_limit: Number(card.credit_limit),
      closing_day: card.closing_day,
      due_day: card.due_day,
      color: card.color || '#1f2937',
      financial_account_id: card.financial_account_id,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    if (!formData.financial_account_id) {
      toast({
        title: 'Conta financeira obrigatória',
        description:
          'Cadastre antes uma conta do tipo cartão em Contas financeiras, depois selecione-a aqui.',
        variant: 'destructive',
      });
      return;
    }
    if (editingCard) {
      updateCard.mutate(
        {
          id: editingCard.id,
          previousFinancialAccountId: editingCard.financial_account_id,
          data: {
            ...formData,
            financial_account_id: formData.financial_account_id,
          },
        },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createCard.mutate(formData, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = (card: CreditCard) => {
    setCardToDelete(card);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (cardToDelete) {
      deleteCard.mutate(cardToDelete.financial_account_id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setCardToDelete(null);
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5" />
            Cartoes de Credito
          </CardTitle>
          <Button onClick={openNew} size="sm" disabled={schemaMissing}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cartao
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {schemaMissing && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {financeDbIssue === 'local_schema'
                  ? 'Postgres local sem tabelas de cartao'
                  : 'Banco financeiro nao configurado'}
              </AlertTitle>
              <AlertDescription>
                {financeDbIssue === 'local_schema' ? FINANCE_DB_LOCAL_SCHEMA_HINT : FINANCE_DB_USER_HINT}
              </AlertDescription>
            </Alert>
          )}

          {!schemaMissing && allCreditAccounts.length === 0 && (
            <Alert>
              <AlertTitle>Nenhuma conta financeira &quot;cartão&quot; disponível</AlertTitle>
              <AlertDescription>
                Crie em <strong>Contas</strong> uma conta do tipo cartão de crédito; depois volte aqui para
                registrar o cartão (fechamento, limite, etc.).
              </AlertDescription>
            </Alert>
          )}

          {!schemaMissing && (!cards || cards.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum cartao cadastrado.</p>
              <Button variant="outline" className="mt-4" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro cartao
              </Button>
            </div>
          )}

          {!schemaMissing &&
            cards?.map((card) => (
              <CreditCardRow
                key={card.id}
                card={card}
                isSelected={selectedCardId === card.id}
                onSelect={() => onSelectCard?.(card)}
                onEdit={() => openEdit(card)}
                onDelete={() => handleDelete(card)}
              />
            ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setAccountComboOpen(false);
      }}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar Cartao' : 'Novo Cartao de Credito'}</DialogTitle>
            <DialogDescription className="text-left">
              Primeiro escolha na <strong>lista suspensa</strong> a conta tipo cartão cadastrada em{' '}
              <strong>Contas financeiras</strong>. Depois ajuste limite, datas e bandeira.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Conta do cartão (lista de contas cadastradas)</Label>
              <Popover open={accountComboOpen} onOpenChange={setAccountComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountComboOpen}
                    className="w-full justify-between font-normal min-h-11 px-3"
                    disabled={!!schemaMissing}
                  >
                    <span className="truncate text-left">
                      {formData.financial_account_id
                        ? (financialAccounts || []).find((a) => a.id === formData.financial_account_id)?.name ??
                          'Conta selecionada'
                        : '— Abrir lista e escolher conta tipo cartão —'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 z-[300] w-[min(calc(100vw-2rem),var(--radix-popover-trigger-width))] min-w-[var(--radix-popover-trigger-width)]"
                  align="start"
                  sideOffset={4}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command>
                    <CommandInput placeholder="Buscar pelo nome da conta..." />
                    <CommandList>
                      <CommandEmpty className="py-6 text-center text-sm px-2">
                        Nenhuma conta tipo &quot;cartão de crédito&quot;. Cadastre em Contas → tipo
                        Cartão.
                      </CommandEmpty>
                      <CommandGroup>
                        {allCreditAccounts.map((a) => {
                          const taken = isFaTakenByOtherCard(a.id);
                          const selected = formData.financial_account_id === a.id;
                          return (
                            <CommandItem
                              key={a.id}
                              value={`${a.name} ${a.id}`}
                              disabled={taken}
                              onSelect={() => {
                                if (taken) return;
                                setFormData((p) => ({
                                  ...p,
                                  financial_account_id: a.id,
                                  name: a.name,
                                }));
                                setAccountComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn('mr-2 h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                              />
                              <span className="truncate flex-1">{a.name}</span>
                              {taken && (
                                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                  já com cartão
                                </span>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Todas as contas financeiras do tipo cartão aparecem na lista; as já usadas em outro cadastro
                de cartão ficam bloqueadas.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cc-name">Nome do cartao</Label>
                <Input
                  id="cc-name"
                  placeholder="Ex: Nubank, Inter Black..."
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Também atualiza o nome da conta financeira.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-brand">Bandeira</Label>
                <Input
                  id="cc-brand"
                  placeholder="Visa, Master, Elo..."
                  value={formData.brand || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, brand: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cc-limit">Limite</Label>
                <Input
                  id="cc-limit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData((p) => ({ ...p, credit_limit: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-closing">Dia fechamento</Label>
                <Input
                  id="cc-closing"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.closing_day}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, closing_day: Math.min(31, Math.max(1, Number(e.target.value))) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-due">Dia vencimento</Label>
                <Input
                  id="cc-due"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.due_day}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, due_day: Math.min(31, Math.max(1, Number(e.target.value))) }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cc-color">Cor</Label>
                <Input
                  id="cc-color"
                  type="color"
                  value={formData.color || '#1f2937'}
                  onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createCard.isPending || updateCard.isPending}>
              {(createCard.isPending || updateCard.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingCard ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Excluir cartao"
        description={`Excluir o cartao "${cardToDelete?.financial_account?.name}" tambem remove suas faturas. Lancamentos vinculados permanecem mas perdem o cartao.`}
        isPending={deleteCard.isPending}
      />
    </>
  );
}

interface CreditCardRowProps {
  card: CreditCard;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CreditCardRow({ card, isSelected, onSelect, onEdit, onDelete }: CreditCardRowProps) {
  const { data: usage } = useCreditCardUsage(card.id, card.financial_account_id);
  const limit = Number(card.credit_limit || 0);
  const used = usage?.used || 0;
  const available = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer ${
        isSelected ? 'bg-muted ring-2 ring-primary' : 'hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center text-white"
          style={{ backgroundColor: card.color || '#1f2937' }}
        >
          <CreditCardIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{card.financial_account?.name || 'Cartao'}</p>
            {card.brand && <Badge variant="outline">{card.brand}</Badge>}
            <Badge variant="secondary" className="text-xs">
              Fech. {card.closing_day} / Venc. {card.due_day}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Conta financeira · uso inclui cartão no lançamento e despesas nesta conta
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>Limite: {formatCurrency(limit)}</span>
            <span>·</span>
            <span>Usado: {formatCurrency(used)}</span>
            <span>·</span>
            <span className={available > 0 ? 'text-green-600' : 'text-red-600'}>
              Disponivel: {formatCurrency(available)}
            </span>
            {usage != null && usage.count > 0 && (
              <>
                <span>·</span>
                <span>{usage.count} lançamento(s)</span>
              </>
            )}
          </div>
          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: pct > 90 ? '#dc2626' : pct > 70 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
