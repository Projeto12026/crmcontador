import { useState, useEffect } from 'react';
import { AccountCategory, AccountCategoryFormData, ACCOUNT_GROUPS, AccountGroupNumber, FinancialAccountType } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface AccountCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AccountCategoryFormData) => void;
  isPending?: boolean;
  category?: AccountCategory | null; // Se passado, é edição
  parentId?: string;
  parentGroupNumber?: AccountGroupNumber;
  existingCategories: AccountCategory[];
}

export function AccountCategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  category,
  parentId,
  parentGroupNumber,
  existingCategories,
}: AccountCategoryDialogProps) {
  const isEditing = !!category;
  
  const [formData, setFormData] = useState<AccountCategoryFormData>({
    id: '',
    name: '',
    group_number: parentGroupNumber || 1,
    parent_id: parentId,
    create_financial_account: false,
    financial_account_type: 'bank',
    financial_account_initial_balance: 0,
  });

  useEffect(() => {
    if (category) {
      setFormData({
        id: category.id,
        name: category.name,
        group_number: category.group_number,
        parent_id: category.parent_id || undefined,
        create_financial_account: false,
      });
    } else {
      // Gerar próximo ID sugerido
      let suggestedId = '';
      if (parentId) {
        // Subconta: encontrar próximo número
        const siblings = existingCategories.filter(c => c.parent_id === parentId);
        const siblingNumbers = siblings.map(s => {
          const parts = s.id.split('.');
          return parseInt(parts[parts.length - 1]) || 0;
        });
        const nextNum = Math.max(0, ...siblingNumbers) + 1;
        suggestedId = `${parentId}.${nextNum}`;
      } else if (parentGroupNumber) {
        // Conta raiz do grupo
        suggestedId = String(parentGroupNumber);
      }
      
      setFormData({
        id: suggestedId,
        name: '',
        group_number: parentGroupNumber || 1,
        parent_id: parentId,
        create_financial_account: false,
        financial_account_type: 'bank',
        financial_account_initial_balance: 0,
      });
    }
  }, [category, parentId, parentGroupNumber, existingCategories, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const canCreateFinancialAccount = formData.group_number === 7 || formData.group_number === 8;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Conta' : 'Nova Conta'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">ID *</Label>
              <Input
                id="id"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="1.1"
                disabled={isEditing}
                required
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>
          
          {!isEditing && !parentId && (
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select 
                value={String(formData.group_number)} 
                onValueChange={(v) => setFormData({ ...formData, group_number: Number(v) as AccountGroupNumber })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_GROUPS).map(([num, name]) => (
                    <SelectItem key={num} value={num}>
                      {num} - {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {parentId && (
            <div className="text-sm text-muted-foreground">
              Subconta de: <span className="font-medium">{parentId}</span> (Grupo {formData.group_number} - {ACCOUNT_GROUPS[formData.group_number as AccountGroupNumber]})
            </div>
          )}
          
          {!isEditing && canCreateFinancialAccount && (
            <>
              <div className="flex items-center gap-3 py-2">
                <Switch
                  id="create_financial"
                  checked={formData.create_financial_account}
                  onCheckedChange={(checked) => setFormData({ ...formData, create_financial_account: checked })}
                />
                <Label htmlFor="create_financial" className="cursor-pointer">
                  Criar conta financeira vinculada
                </Label>
              </div>
              
              {formData.create_financial_account && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select 
                      value={formData.financial_account_type} 
                      onValueChange={(v) => setFormData({ ...formData, financial_account_type: v as FinancialAccountType })}
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
                    <Label>Saldo Inicial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.financial_account_initial_balance || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        financial_account_initial_balance: Number(e.target.value) 
                      })}
                    />
                  </div>
                </div>
              )}
            </>
          )}
          
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
