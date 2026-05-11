import { useState } from 'react';
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
import { Plus, Pencil, Trash2, Loader2, CreditCard as CreditCardIcon } from 'lucide-react';
import { CreditCard, CreditCardFormData } from '@/types/crm';
import {
  useCreditCards,
  useCreateCreditCard,
  useUpdateCreditCard,
  useDeleteCreditCard,
  useCreditCardUsage,
} from '@/hooks/useCreditCards';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface CreditCardManagerProps {
  onSelectCard?: (card: CreditCard) => void;
  selectedCardId?: string | null;
}

export function CreditCardManager({ onSelectCard, selectedCardId }: CreditCardManagerProps) {
  const { data: cards, isLoading } = useCreditCards();
  const createCard = useCreateCreditCard();
  const updateCard = useUpdateCreditCard();
  const deleteCard = useDeleteCreditCard();

  const [dialogOpen, setDialogOpen] = useState(false);
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
    initial_balance: 0,
  });

  const openNew = () => {
    setEditingCard(null);
    setFormData({
      name: '',
      brand: '',
      credit_limit: 0,
      closing_day: 1,
      due_day: 10,
      color: '#1f2937',
      initial_balance: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setFormData({
      name: card.financial_account?.name || '',
      brand: card.brand || '',
      credit_limit: Number(card.credit_limit),
      closing_day: card.closing_day,
      due_day: card.due_day,
      color: card.color || '#1f2937',
      initial_balance: Number(card.financial_account?.initial_balance || 0),
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    if (editingCard) {
      updateCard.mutate(
        {
          id: editingCard.id,
          data: { ...formData, financial_account_id: editingCard.financial_account_id },
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
          <Button onClick={openNew} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Novo Cartao
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!cards || cards.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum cartao cadastrado.</p>
              <Button variant="outline" className="mt-4" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro cartao
              </Button>
            </div>
          )}

          {cards?.map((card) => (
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar Cartao' : 'Novo Cartao de Credito'}</DialogTitle>
            <DialogDescription>
              Informe os dados do cartao. Fechamento e vencimento sao dias do mes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cc-name">Nome do cartao</Label>
                <Input
                  id="cc-name"
                  placeholder="Ex: Nubank, Inter Black..."
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
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
              {!editingCard && (
                <div className="space-y-2">
                  <Label htmlFor="cc-initial">Saldo inicial</Label>
                  <Input
                    id="cc-initial"
                    type="number"
                    step="0.01"
                    value={formData.initial_balance ?? 0}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, initial_balance: Number(e.target.value) }))
                    }
                  />
                </div>
              )}
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
  const { data: usage } = useCreditCardUsage(card.id);
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
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Limite: {formatCurrency(limit)}</span>
            <span>·</span>
            <span>Usado: {formatCurrency(used)}</span>
            <span>·</span>
            <span className={available > 0 ? 'text-green-600' : 'text-red-600'}>
              Disponivel: {formatCurrency(available)}
            </span>
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
