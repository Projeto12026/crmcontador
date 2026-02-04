import { useState } from 'react';
import { useEmpresas, useDeleteEmpresa, useCreateEmpresa, useUpdateEmpresa } from '@/hooks/useEmpresas';
import { useSyncStatus, useSyncAllStatus } from '@/hooks/useStatusSync';
import { Empresa, EmpresaStatus } from '@/types/empresa';
import { EmpresaFormData, formatCNPJ } from '@/lib/validators';
import { EmpresaForm } from './EmpresaForm';
import { EmpresaStats } from './EmpresaStats';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, Building2, RefreshCw, Loader2 } from 'lucide-react';

const statusColors: Record<EmpresaStatus, string> = {
  UNKNOWN: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-primary/10 text-primary',
  INACTIVE: 'bg-muted text-muted-foreground',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  OVERDUE: 'bg-destructive/10 text-destructive',
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  LATE: 'bg-destructive/10 text-destructive',
  PAID: 'bg-primary/10 text-primary',
  CANCELLED: 'bg-muted text-muted-foreground',
  ERRO_CONSULTA: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
};

const statusLabels: Record<EmpresaStatus, string> = {
  UNKNOWN: 'Desconhecido',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  PENDING: 'Pendente',
  OVERDUE: 'Vencido',
  OPEN: 'Aberto',
  LATE: 'Atrasado',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
  ERRO_CONSULTA: 'Erro Consulta',
};

const formaEnvioLabels: Record<string, string> = {
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  CORA: 'Cora',
  NELSON: 'Nelson',
};

export function EmpresaList() {
  const [statusFilter, setStatusFilter] = useState<EmpresaStatus | 'ALL'>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empresaToDelete, setEmpresaToDelete] = useState<Empresa | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncCompetencia, setSyncCompetencia] = useState('');
  const [syncingEmpresaId, setSyncingEmpresaId] = useState<string | null>(null);

  const { data: empresas, isLoading } = useEmpresas(statusFilter);
  const createMutation = useCreateEmpresa();
  const updateMutation = useUpdateEmpresa();
  const deleteMutation = useDeleteEmpresa();
  const syncMutation = useSyncStatus();
  const syncAllMutation = useSyncAllStatus();

  const handleCreate = () => {
    setEditingEmpresa(null);
    setFormOpen(true);
  };

  const handleEdit = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    setFormOpen(true);
  };

  const handleDelete = (empresa: Empresa) => {
    setEmpresaToDelete(empresa);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (empresaToDelete) {
      deleteMutation.mutate(empresaToDelete.id);
      setDeleteDialogOpen(false);
      setEmpresaToDelete(null);
    }
  };

  const handleSubmit = (data: EmpresaFormData) => {
    if (editingEmpresa) {
      updateMutation.mutate({ id: editingEmpresa.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSyncSingle = async (empresa: Empresa) => {
    const now = new Date();
    const competencia = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    setSyncingEmpresaId(empresa.id);
    try {
      await syncMutation.mutateAsync({
        empresaId: empresa.id,
        cnpj: empresa.cnpj,
        competencia,
      });
    } finally {
      setSyncingEmpresaId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!syncCompetencia || !/^\d{2}\/\d{4}$/.test(syncCompetencia)) return;
    
    await syncAllMutation.mutateAsync({ competencia: syncCompetencia });
    setSyncDialogOpen(false);
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const handleCompetenciaChange = (value: string) => {
    let formatted = value.replace(/\D/g, '');
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + '/' + formatted.slice(2, 6);
    }
    setSyncCompetencia(formatted);
  };

  return (
    <div className="space-y-6">
      <EmpresaStats />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Lista de Empresas</h2>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as EmpresaStatus | 'ALL')}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="OPEN">Abertos</SelectItem>
              <SelectItem value="LATE">Atrasados</SelectItem>
              <SelectItem value="PAID">Pagos</SelectItem>
              <SelectItem value="CANCELLED">Cancelados</SelectItem>
              <SelectItem value="ERRO_CONSULTA">Erro Consulta</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="INACTIVE">Inativos</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              <SelectItem value="OVERDUE">Vencidos</SelectItem>
              <SelectItem value="UNKNOWN">Desconhecidos</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setSyncDialogOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar Todos
          </Button>
          
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Apelido</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Forma Envio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : empresas?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma empresa encontrada
                </TableCell>
              </TableRow>
            ) : (
              empresas?.map((empresa) => (
                <TableRow key={empresa.id}>
                  <TableCell className="font-medium">{empresa.nome}</TableCell>
                  <TableCell>{empresa.apelido || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatCNPJ(empresa.cnpj)}
                  </TableCell>
                  <TableCell>{empresa.telefone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formaEnvioLabels[empresa.forma_envio] || empresa.forma_envio}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[empresa.status]}>
                      {statusLabels[empresa.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatAmount(empresa.amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSyncSingle(empresa)}
                        disabled={syncingEmpresaId === empresa.id}
                        title="Sincronizar status"
                      >
                        {syncingEmpresaId === empresa.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(empresa)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(empresa)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EmpresaForm
        open={formOpen}
        onOpenChange={setFormOpen}
        empresa={editingEmpresa}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{empresaToDelete?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Sincronizar Status de Todas as Empresas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sync-competencia">Competência</Label>
              <Input
                id="sync-competencia"
                value={syncCompetencia}
                onChange={(e) => handleCompetenciaChange(e.target.value)}
                placeholder="MM/AAAA"
                maxLength={7}
              />
              <p className="text-sm text-muted-foreground">
                Informe a competência para buscar o status dos boletos na Cora
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSyncAll}
              disabled={!syncCompetencia || !/^\d{2}\/\d{4}$/.test(syncCompetencia) || syncAllMutation.isPending}
            >
              {syncAllMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
