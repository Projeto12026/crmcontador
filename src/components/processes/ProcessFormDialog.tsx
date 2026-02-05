import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { useProcessTemplates, useCreateProcess } from '@/hooks/useProcesses';

interface ProcessFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subprocess: string;
  subprocessLabel: string;
}

export function ProcessFormDialog({ open, onOpenChange, subprocess, subprocessLabel }: ProcessFormDialogProps) {
  const { data: clients = [] } = useClients();
  const { data: templates = [] } = useProcessTemplates();
  const createProcess = useCreateProcess();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    template_id: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        title: subprocessLabel,
        description: '',
        client_id: '',
        template_id: '',
      });
    }
  }, [open, subprocessLabel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id) return;

    await createProcess.mutateAsync({
      title: formData.title,
      description: formData.description || null,
      client_id: formData.client_id,
      templateId: formData.template_id || undefined,
      status: 'pending',
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Processo - {subprocessLabel}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Cliente *</Label>
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
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Modelo de Processo</Label>
            <Select
              value={formData.template_id}
              onValueChange={(value) => setFormData({ ...formData, template_id: value === 'none' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um modelo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem modelo</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.steps?.length || 0} etapas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formData.client_id || createProcess.isPending}>
              {createProcess.isPending ? 'Criando...' : 'Criar Processo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
