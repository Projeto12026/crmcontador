import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { useClients } from '@/hooks/useClients';
import { useOnboardingTemplates, useStartOnboarding } from '@/hooks/useOnboarding';
import { FileText, Users } from 'lucide-react';

interface StartOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartOnboardingDialog({ open, onOpenChange }: StartOnboardingDialogProps) {
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');

  const { data: clients } = useClients();
  const { data: templates } = useOnboardingTemplates();
  const startOnboarding = useStartOnboarding();

  const selectedTemplate = templates?.find(t => t.id === templateId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !templateId) return;
    
    await startOnboarding.mutateAsync({ client_id: clientId, template_id: templateId });
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setClientId('');
    setTemplateId('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Iniciar Onboarding</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cliente *
            </Label>
            <Select value={clientId || 'none'} onValueChange={(v) => setClientId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione um cliente</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Template *
            </Label>
            <Select value={templateId || 'none'} onValueChange={(v) => setTemplateId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione um template</SelectItem>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-sm text-muted-foreground">
                {selectedTemplate.items?.length || 0} itens no checklist
              </p>
            )}
          </div>

          {templates?.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              Você ainda não tem templates de onboarding. Crie um template primeiro.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!clientId || !templateId || startOnboarding.isPending}
            >
              {startOnboarding.isPending ? 'Iniciando...' : 'Iniciar Onboarding'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
