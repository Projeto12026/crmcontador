import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { ProcessWithDetails, useUpdateProcess } from '@/hooks/useProcesses';
import { Database } from '@/integrations/supabase/types';

type ProcessStatus = Database['public']['Enums']['process_status'];

const STATUS_OPTIONS: { value: ProcessStatus; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'awaiting_docs', label: 'Aguardando Documentos' },
  { value: 'awaiting_client', label: 'Aguardando Cliente' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
];

interface ProcessEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: ProcessWithDetails | null;
}

export function ProcessEditDialog({ open, onOpenChange, process }: ProcessEditDialogProps) {
  const { data: clients = [] } = useClients();
  const updateProcess = useUpdateProcess();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    status: 'pending' as ProcessStatus,
  });

  useEffect(() => {
    if (open && process) {
      setFormData({
        title: process.title,
        description: process.description || '',
        client_id: process.client_id,
        status: process.status,
      });
    }
  }, [open, process]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!process || !formData.client_id) return;

    await updateProcess.mutateAsync({
      id: process.id,
      data: {
        title: formData.title,
        description: formData.description || null,
        client_id: formData.client_id,
        status: formData.status,
        completed_at: formData.status === 'completed' ? new Date().toISOString() : null,
      },
    });

    onOpenChange(false);
  };

  if (!process) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Processo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-client">Cliente *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(value) => setFormData({ ...formData, client_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
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

          <div className="space-y-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input
              id="edit-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as ProcessStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formData.client_id || updateProcess.isPending}>
              {updateProcess.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
