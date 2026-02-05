import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { useCreateProcessTemplate, useUpdateProcessTemplate } from '@/hooks/useProcesses';
import { Tables } from '@/integrations/supabase/types';

type ProcessTemplate = Tables<'process_templates'>;
type ProcessTemplateStep = Tables<'process_template_steps'>;

interface ProcessTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: (ProcessTemplate & { steps: ProcessTemplateStep[] }) | null;
}

interface StepData {
  id?: string;
  name: string;
  description: string;
  estimated_days: number;
}

export function ProcessTemplateDialog({ open, onOpenChange, template }: ProcessTemplateDialogProps) {
  const createTemplate = useCreateProcessTemplate();
  const updateTemplate = useUpdateProcessTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<StepData[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setDescription(template.description || '');
        setSteps(
          template.steps
            .sort((a, b) => a.order_index - b.order_index)
            .map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description || '',
              estimated_days: s.estimated_days || 0,
            }))
        );
      } else {
        setName('');
        setDescription('');
        setSteps([{ name: '', description: '', estimated_days: 0 }]);
      }
    }
  }, [open, template]);

  const addStep = () => {
    setSteps([...steps, { name: '', description: '', estimated_days: 0 }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof StepData, value: string | number) => {
    setSteps(
      steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step
      )
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSteps = [...steps];
    const draggedItem = newSteps[draggedIndex];
    newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, draggedItem);
    setSteps(newSteps);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validSteps = steps.filter((s) => s.name.trim());

    if (template) {
      await updateTemplate.mutateAsync({
        id: template.id,
        data: { name, description, steps: validSteps },
      });
    } else {
      await createTemplate.mutateAsync({ name, description, steps: validSteps });
    }

    onOpenChange(false);
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar Modelo de Processo' : 'Novo Modelo de Processo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Modelo *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Abertura ME Simples"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição breve"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Etapas do Processo</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Etapa
              </Button>
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-start gap-2 p-3 border rounded-lg bg-background ${
                    draggedIndex === index ? 'opacity-50 border-primary' : ''
                  }`}
                >
                  <div className="cursor-grab mt-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <Input
                        value={step.name}
                        onChange={(e) => updateStep(index, 'name', e.target.value)}
                        placeholder="Nome da etapa"
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        value={step.description}
                        onChange={(e) => updateStep(index, 'description', e.target.value)}
                        placeholder="Descrição"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={step.estimated_days || ''}
                        onChange={(e) => updateStep(index, 'estimated_days', parseInt(e.target.value) || 0)}
                        placeholder="Dias"
                        min={0}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStep(index)}
                    disabled={steps.length === 1}
                    className="mt-0.5"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? 'Salvando...' : template ? 'Salvar Alterações' : 'Criar Modelo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
