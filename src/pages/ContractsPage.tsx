import { useState } from 'react';
import { useContracts, useCreateContract, useUpdateContract, useDeleteContract } from '@/hooks/useContracts';
import { useClients } from '@/hooks/useClients';
import { Contract, ContractFormData, ContractStatus, ContractManager, TaxType } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

const statusConfig: Record<ContractStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; isFinalized: boolean }> = {
  draft: { label: 'Rascunho', variant: 'secondary', isFinalized: false },
  active: { label: 'Ativo', variant: 'default', isFinalized: false },
  suspended: { label: 'Suspenso', variant: 'outline', isFinalized: true },
  cancelled: { label: 'Cancelado', variant: 'destructive', isFinalized: true },
  expired: { label: 'Expirado', variant: 'secondary', isFinalized: true },
};

const taxTypeConfig: Record<TaxType, { label: string; color: string }> = {
  simples: { label: 'Simples', color: 'bg-green-100 text-green-800' },
  lp: { label: 'Lucro Presumido', color: 'bg-blue-100 text-blue-800' },
  mei: { label: 'MEI', color: 'bg-purple-100 text-purple-800' },
};

export function ContractsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [activeTab, setActiveTab] = useState<ContractManager>('nescon');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [taxTypeFilter, setTaxTypeFilter] = useState<TaxType | 'all'>('all');

  const { data: contracts, isLoading } = useContracts({
    manager: activeTab,
    status: statusFilter === 'all' ? undefined : statusFilter,
    taxType: taxTypeFilter === 'all' ? undefined : taxTypeFilter,
  });
  const { data: clients } = useClients();
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();

  const [formData, setFormData] = useState<ContractFormData & { status?: ContractStatus }>({
    client_id: null,
    client_name: '',
    title: '',
    description: '',
    monthly_value: undefined,
    start_date: '',
    end_date: '',
    billing_day: 10,
    notes: '',
    manager: 'nescon',
    tax_type: undefined,
    status: 'draft',
  });
  const [clientInputMode, setClientInputMode] = useState<'select' | 'free'>('select');

  const openNewDialog = () => {
    setEditingContract(null);
    setClientInputMode('select');
    setFormData({
      client_id: null,
      client_name: '',
      title: '',
      description: '',
      monthly_value: undefined,
      start_date: '',
      end_date: '',
      billing_day: 10,
      notes: '',
      manager: activeTab,
      tax_type: undefined,
    });
    setIsOpen(true);
  };

  const openEditDialog = (contract: Contract) => {
    setEditingContract(contract);
    // Determine input mode based on whether contract has a linked client
    const hasLinkedClient = !!contract.client_id && !!contract.client;
    setClientInputMode(hasLinkedClient ? 'select' : 'free');
    setFormData({
      client_id: contract.client_id || null,
      client_name: contract.client_name || contract.client?.name || '',
      title: contract.title,
      description: contract.description || '',
      monthly_value: contract.monthly_value || undefined,
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      billing_day: contract.billing_day || 10,
      notes: contract.notes || '',
      manager: contract.manager || 'nescon',
      tax_type: contract.tax_type || undefined,
      status: contract.status,
    });
    setIsOpen(true);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert empty strings to null/undefined for date fields
    const sanitizedData = {
      ...formData,
      client_id: formData.client_id || null,
      client_name: formData.client_name || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      description: formData.description || null,
      notes: formData.notes || null,
    };
    
    if (editingContract) {
      await updateContract.mutateAsync({ id: editingContract.id, data: sanitizedData });
    } else {
      await createContract.mutateAsync(sanitizedData);
    }
    setIsOpen(false);
  };

  const activateContract = (contract: Contract) => {
    updateContract.mutate({ id: contract.id, data: { status: 'active' } });
  };

  const totalMonthlyActive = contracts
    ?.filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + (c.monthly_value || 0), 0) || 0;

  const totalMonthlyDraft = contracts
    ?.filter((c) => c.status === 'draft')
    .reduce((sum, c) => sum + (c.monthly_value || 0), 0) || 0;

  const totalMonthlyAll = contracts
    ?.reduce((sum, c) => sum + (c.monthly_value || 0), 0) || 0;

  const renderContractsTable = (contractsList: Contract[], showFinalized: boolean = false) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    // Filter by finalized status
    const filtered = contractsList?.filter(c => statusConfig[c.status].isFinalized === showFinalized) || [];

    if (!filtered.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {showFinalized ? 'Nenhum contrato finalizado' : 'Nenhum contrato ativo'}
        </div>
      );
    }

    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo Tributário</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contract) => {
                const isFinalized = statusConfig[contract.status].isFinalized;
                return (
                  <TableRow 
                    key={contract.id} 
                    className={isFinalized ? 'opacity-60 bg-muted/30' : ''}
                  >
                    <TableCell className="font-medium">
                      {contract.client?.name || contract.client_name || '-'}
                    </TableCell>
                    <TableCell>{contract.title}</TableCell>
                    <TableCell>
                      {contract.tax_type ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${taxTypeConfig[contract.tax_type].color}`}>
                          {taxTypeConfig[contract.tax_type].label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contract.monthly_value
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.monthly_value)
                        : '-'}
                    </TableCell>
                    <TableCell>Dia {contract.billing_day || 10}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[contract.status].variant}>
                        {statusConfig[contract.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {contract.status === 'draft' && (
                          <Button variant="ghost" size="sm" onClick={() => activateContract(contract)}>
                            Ativar
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(contract)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteContract.mutate(contract.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
  };

  // Count finalized contracts
  const finalizedCount = contracts?.filter(c => statusConfig[c.status].isFinalized).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contratos</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              <strong>Receita Ativa:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMonthlyActive)}
            </span>
            {totalMonthlyDraft > 0 && (
              <span>
                <strong>Rascunhos:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMonthlyDraft)}
              </span>
            )}
            <span className="text-xs">({activeTab === 'nescon' ? 'Nescon' : 'Jean'})</span>
          </div>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContractManager)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="nescon">Gestão de Contratos Nescon</TabsTrigger>
          <TabsTrigger value="jean">Gestão de Contratos Jean</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-4 mt-4">
          {/* Status Filter */}
          <div className="flex gap-2">
            {(['all', 'active', 'draft', 'suspended', 'cancelled'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'Todos' : statusConfig[status].label}
              </Button>
            ))}
          </div>

          {/* Tax Type Filter */}
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Tipo:</span>
            {(['all', 'simples', 'lp', 'mei'] as const).map((taxType) => (
              <Button
                key={taxType}
                variant={taxTypeFilter === taxType ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTaxTypeFilter(taxType)}
              >
                {taxType === 'all' ? 'Todos' : taxTypeConfig[taxType].label}
              </Button>
            ))}
          </div>
        </div>

        <TabsContent value="nescon" className="mt-4 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Contratos Ativos</h3>
            {renderContractsTable(contracts || [], false)}
          </div>
          {finalizedCount > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                Contratos Finalizados ({finalizedCount})
              </h3>
              {renderContractsTable(contracts || [], true)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jean" className="mt-4 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Contratos Ativos</h3>
            {renderContractsTable(contracts || [], false)}
          </div>
          {finalizedCount > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                Contratos Finalizados ({finalizedCount})
              </h3>
              {renderContractsTable(contracts || [], true)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContract ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={clientInputMode === 'select' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setClientInputMode('select');
                    setFormData({ ...formData, client_name: '', client_id: null });
                  }}
                >
                  Selecionar cadastrado
                </Button>
                <Button
                  type="button"
                  variant={clientInputMode === 'free' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setClientInputMode('free');
                    setFormData({ ...formData, client_id: null });
                  }}
                >
                  Nome livre
                </Button>
              </div>
              {clientInputMode === 'select' ? (
                <Select 
                  value={formData.client_id || 'none'} 
                  onValueChange={(v) => setFormData({ ...formData, client_id: v === 'none' ? null : v, client_name: null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={formData.client_name || ''}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value, client_id: null })}
                  placeholder="Digite o nome do cliente"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gestor *</Label>
                <Select 
                  value={formData.manager || 'nescon'} 
                  onValueChange={(v) => setFormData({ ...formData, manager: v as ContractManager })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nescon">Nescon</SelectItem>
                    <SelectItem value="jean">Jean</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo Tributário</Label>
                <Select 
                  value={formData.tax_type || 'none'} 
                  onValueChange={(v) => setFormData({ ...formData, tax_type: v === 'none' ? undefined : v as TaxType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="simples">Simples</SelectItem>
                    <SelectItem value="lp">Lucro Presumido</SelectItem>
                    <SelectItem value="mei">MEI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingContract && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status || 'draft'} 
                  onValueChange={(v) => setFormData({ ...formData, status: v as ContractStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_value">Valor Mensal</Label>
                <Input
                  id="monthly_value"
                  type="number"
                  value={formData.monthly_value || ''}
                  onChange={(e) => setFormData({ ...formData, monthly_value: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_day">Dia do Vencimento</Label>
                <Input
                  id="billing_day"
                  type="number"
                  min={1}
                  max={31}
                  value={formData.billing_day || 10}
                  onChange={(e) => setFormData({ ...formData, billing_day: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Data Fim</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createContract.isPending || updateContract.isPending}>
                {createContract.isPending || updateContract.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}