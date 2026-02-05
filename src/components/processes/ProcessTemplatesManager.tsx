import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import { useProcessTemplates, useDeleteProcessTemplate } from '@/hooks/useProcesses';
import { ProcessTemplateDialog } from './ProcessTemplateDialog';
import { Tables } from '@/integrations/supabase/types';

type ProcessTemplate = Tables<'process_templates'>;
type ProcessTemplateStep = Tables<'process_template_steps'>;

export function ProcessTemplatesManager() {
  const { data: templates = [], isLoading } = useProcessTemplates();
  const deleteTemplate = useDeleteProcessTemplate();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<(ProcessTemplate & { steps: ProcessTemplateStep[] }) | null>(null);

  const handleEdit = (template: ProcessTemplate & { steps: ProcessTemplateStep[] }) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este modelo?')) {
      await deleteTemplate.mutateAsync(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando modelos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Modelos de Processo</h2>
          <p className="text-sm text-muted-foreground">
            Crie modelos com etapas pré-definidas para agilizar a criação de processos
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Modelo
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum modelo cadastrado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Crie modelos de processo com etapas pré-definidas para padronizar seus fluxos de trabalho.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Modelo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(template)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {template.description && (
                  <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{template.steps?.length || 0} etapas</Badge>
                  </div>
                  {template.steps && template.steps.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {template.steps
                        .sort((a, b) => a.order_index - b.order_index)
                        .slice(0, 3)
                        .map((step, i) => (
                          <div key={step.id} className="truncate">
                            {i + 1}. {step.name}
                          </div>
                        ))}
                      {template.steps.length > 3 && (
                        <div className="text-muted-foreground">+{template.steps.length - 3} mais...</div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProcessTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={selectedTemplate}
      />
    </div>
  );
}
