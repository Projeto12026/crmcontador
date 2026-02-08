import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import {
  useServiceCatalog,
  useCreateServiceCatalogItem,
  useUpdateServiceCatalogItem,
  useDeleteServiceCatalogItem,
  PricingServiceCatalog,
} from '@/hooks/usePricing';

const DEPARTMENTS: Record<string, { label: string; color: string }> = {
  contabil: { label: 'Contábil', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  fiscal: { label: 'Fiscal', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  pessoal: { label: 'Pessoal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  societario: { label: 'Societário', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  consultoria: { label: 'Consultoria', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
};

const SERVICE_TYPES: Record<string, string> = {
  recurring: 'Recorrente',
  annual: 'Anual',
  one_time: 'Pontual',
};

export function ServiceCatalogManager() {
  const { data: services, isLoading } = useServiceCatalog();
  const createItem = useCreateServiceCatalogItem();
  const updateItem = useUpdateServiceCatalogItem();
  const deleteItem = useDeleteServiceCatalogItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PricingServiceCatalog | null>(null);
  const [form, setForm] = useState({ name: '', department: 'contabil', description: '', default_hours_per_month: 1, service_type: 'recurring', included_employees: null as number | null, additional_employee_value: null as number | null });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', department: 'contabil', description: '', default_hours_per_month: 1, service_type: 'recurring', included_employees: null, additional_employee_value: null });
    setDialogOpen(true);
  };

  const openEdit = (item: PricingServiceCatalog) => {
    setEditing(item);
    setForm({
      name: item.name,
      department: item.department,
      description: item.description || '',
      default_hours_per_month: item.default_hours_per_month,
      service_type: (item as any).service_type || 'recurring',
      included_employees: item.included_employees,
      additional_employee_value: item.additional_employee_value,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editing) {
      updateItem.mutate({ id: editing.id, data: form }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createItem.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const grouped = (services || []).reduce<Record<string, PricingServiceCatalog[]>>((acc, s) => {
    (acc[s.department] = acc[s.department] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Catálogo de serviços com horas estimadas por atividade
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        Object.entries(DEPARTMENTS).map(([key, dept]) => {
          const items = grouped[key];
          if (!items || items.length === 0) return null;
          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="secondary" className={dept.color}>{dept.label}</Badge>
                  <span className="text-xs text-muted-foreground">({items.length} serviços)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {(item as any).service_type && (item as any).service_type !== 'recurring' && (
                          <Badge variant="secondary" className="text-[10px]">
                            {SERVICE_TYPES[(item as any).service_type] || (item as any).service_type}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.default_hours_per_month}h
                        </span>
                        {item.included_employees != null && (
                          <Badge variant="outline" className="text-[10px]">
                            {item.included_employees} func. + R$ {item.additional_employee_value?.toFixed(0)}/adic.
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem.mutate(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Serviço</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPARTMENTS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horas Padrão</Label>
                <Input type="number" min={0.5} step={0.5} value={form.default_hours_per_month} onChange={e => setForm(f => ({ ...f, default_hours_per_month: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Serviço</Label>
                <Select value={form.service_type} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <Label className="text-xs font-semibold text-muted-foreground">Regra de Funcionários Adicionais</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Funcionários Inclusos</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ex: 3"
                    value={form.included_employees ?? ''}
                    onChange={e => setForm(f => ({ ...f, included_employees: e.target.value ? Number(e.target.value) : null }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor por Adicional (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Ex: 50,00"
                    value={form.additional_employee_value ?? ''}
                    onChange={e => setForm(f => ({ ...f, additional_employee_value: e.target.value ? Number(e.target.value) : null }))}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco se este serviço não cobra por funcionário adicional.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name || createItem.isPending || updateItem.isPending}>
              {(createItem.isPending || updateItem.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
