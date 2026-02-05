import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FolderKanban, ArrowRightLeft, Building2, FileCheck, Shield, MapPin, AlertTriangle, Settings } from 'lucide-react';
import { useProcesses } from '@/hooks/useProcesses';
import { ProcessFormDialog } from '@/components/processes/ProcessFormDialog';
import { ProcessKanbanView } from '@/components/processes/ProcessKanbanView';
import { ProcessTemplatesManager } from '@/components/processes/ProcessTemplatesManager';

const subprocesses = [
  { id: 'migracao-mei-me', label: 'Migração MEI - ME', icon: ArrowRightLeft },
  { id: 'ei-slu', label: 'EI para SLU', icon: Building2 },
  { id: 'ei-ltda', label: 'EI para LTDA', icon: Building2 },
  { id: 'opcao-simples', label: 'Opção Simples', icon: FileCheck },
  { id: 'regularizacao', label: 'Regularização', icon: Shield },
  { id: 'licenciamento-cli', label: 'Licenciamento CLI', icon: MapPin },
  { id: 'empresas-regularizar', label: 'Empresas a Regularizar', icon: AlertTriangle },
];

export function ProcessesPage() {
  const [activeTab, setActiveTab] = useState('migracao-mei-me');
  const [showTemplates, setShowTemplates] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedSubprocess, setSelectedSubprocess] = useState<{ id: string; label: string } | null>(null);

  const { data: processes = [], isLoading } = useProcesses();

  const handleNewProcess = (subprocess: { id: string; label: string }) => {
    setSelectedSubprocess(subprocess);
    setFormDialogOpen(true);
  };

  // Normalize string for comparison (remove accents, hyphens, extra spaces)
  const normalizeString = (str: string) => 
    str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const getProcessesForSubprocess = (subprocessId: string) => {
    const normalizedSubprocessId = normalizeString(subprocessId);
    return processes.filter((p) => {
      const normalizedTitle = normalizeString(p.title);
      return normalizedTitle.includes(normalizedSubprocessId) || 
             normalizedSubprocessId.includes(normalizedTitle.split(' ').slice(0, 2).join(' '));
    });
  };

  const activeSubprocess = subprocesses.find((s) => s.id === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processos</h1>
          <p className="text-muted-foreground">Acompanhe os processos de legalização</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(!showTemplates)}>
            <Settings className="h-4 w-4 mr-2" />
            {showTemplates ? 'Ver Processos' : 'Modelos'}
          </Button>
          {!showTemplates && activeSubprocess && (
            <Button onClick={() => handleNewProcess(activeSubprocess)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Processo
            </Button>
          )}
        </div>
      </div>

      {showTemplates ? (
        <ProcessTemplatesManager />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {subprocesses.map((sub) => {
              const Icon = sub.icon;
              const count = getProcessesForSubprocess(sub.id).length;
              return (
                <TabsTrigger
                  key={sub.id}
                  value={sub.id}
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{sub.label}</span>
                  {count > 0 && (
                    <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {subprocesses.map((sub) => {
            const Icon = sub.icon;
            const subprocessProcesses = getProcessesForSubprocess(sub.id);

            return (
              <TabsContent key={sub.id} value={sub.id} className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {sub.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Carregando processos...</div>
                    ) : subprocessProcesses.length > 0 ? (
                      <ProcessKanbanView processes={subprocessProcesses} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Nenhum processo encontrado</h3>
                        <p className="text-muted-foreground text-center max-w-md mb-4">
                          Ainda não há processos de {sub.label.toLowerCase()} cadastrados.
                        </p>
                        <Button variant="outline" onClick={() => handleNewProcess(sub)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Iniciar Processo
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {selectedSubprocess && (
        <ProcessFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          subprocess={selectedSubprocess.id}
          subprocessLabel={selectedSubprocess.label}
        />
      )}
    </div>
  );
}
