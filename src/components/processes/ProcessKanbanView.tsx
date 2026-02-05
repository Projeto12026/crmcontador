import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, User, Calendar, CheckCircle2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProcessWithDetails, useUpdateProcessStep, useProcessTemplates } from '@/hooks/useProcesses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types';

type ProcessStep = Tables<'process_steps'>;
type ProcessTemplateStep = Tables<'process_template_steps'>;

interface ProcessKanbanViewProps {
  processes: ProcessWithDetails[];
  subprocessLabel?: string;
  onEditProcess?: (process: ProcessWithDetails) => void;
  onDeleteProcess?: (id: string) => void;
}

export function ProcessKanbanView({ processes, subprocessLabel, onEditProcess, onDeleteProcess }: ProcessKanbanViewProps) {
  const { data: templates = [] } = useProcessTemplates();
  const updateStep = useUpdateProcessStep();
  const [draggedProcess, setDraggedProcess] = useState<ProcessWithDetails | null>(null);

  // Normalize string for comparison
  const normalizeString = (str: string) => 
    str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Find template by subprocess label
  const activeTemplate = useMemo(() => {
    if (!subprocessLabel) return null;
    
    const normalizedLabel = normalizeString(subprocessLabel);
    
    // Find template that matches the subprocess label
    return templates.find(t => {
      const normalizedName = normalizeString(t.name);
      return normalizedName.includes(normalizedLabel) || normalizedLabel.includes(normalizedName);
    }) || null;
  }, [subprocessLabel, templates]);

  // Get columns from template steps or fallback to default
  const columns = useMemo(() => {
    if (activeTemplate?.steps && activeTemplate.steps.length > 0) {
      return activeTemplate.steps
        .sort((a, b) => a.order_index - b.order_index)
        .map((step, index) => ({
          id: step.id,
          name: step.name,
          order: step.order_index,
          color: getStepColor(index, activeTemplate.steps.length),
        }));
    }
    
    // Fallback columns
    return [
      { id: 'pending', name: 'Pendente', order: 0, color: 'bg-slate-500' },
      { id: 'in_progress', name: 'Em Andamento', order: 1, color: 'bg-blue-500' },
      { id: 'completed', name: 'Concluído', order: 2, color: 'bg-green-500' },
    ];
  }, [activeTemplate]);

  // Determine which column a process belongs to based on its current step
  const getProcessColumn = (process: ProcessWithDetails): string => {
    if (!process.steps || process.steps.length === 0) {
      return columns[0]?.id || 'pending';
    }

    // Sort steps by order
    const sortedSteps = [...process.steps].sort((a, b) => a.order_index - b.order_index);
    
    // Find the first non-completed step (current step)
    const currentStep = sortedSteps.find(s => s.status !== 'completed');
    
    // If all steps completed, put in last column
    if (!currentStep) {
      return columns[columns.length - 1]?.id || 'completed';
    }

    // Match by name to template step
    const matchingColumn = columns.find(col => 
      col.name.toLowerCase() === currentStep.name.toLowerCase()
    );
    
    if (matchingColumn) return matchingColumn.id;

    // Match by order index
    const columnByOrder = columns[currentStep.order_index];
    if (columnByOrder) return columnByOrder.id;

    return columns[0]?.id || 'pending';
  };

  const handleDragStart = (process: ProcessWithDetails) => {
    setDraggedProcess(process);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetColumnId: string) => {
    if (!draggedProcess) {
      setDraggedProcess(null);
      return;
    }

    const currentColumn = getProcessColumn(draggedProcess);
    if (currentColumn === targetColumnId) {
      setDraggedProcess(null);
      return;
    }

    // Find target column index
    const targetIndex = columns.findIndex(c => c.id === targetColumnId);
    const currentIndex = columns.findIndex(c => c.id === currentColumn);

    if (targetIndex === -1 || !draggedProcess.steps) {
      setDraggedProcess(null);
      return;
    }

    // Sort steps by order
    const sortedSteps = [...draggedProcess.steps].sort((a, b) => a.order_index - b.order_index);

    // If moving forward, complete all steps up to target
    if (targetIndex > currentIndex) {
      for (let i = 0; i <= targetIndex && i < sortedSteps.length; i++) {
        if (i < targetIndex && sortedSteps[i].status !== 'completed') {
          await updateStep.mutateAsync({
            id: sortedSteps[i].id,
            data: { 
              status: 'completed',
              completed_at: new Date().toISOString()
            }
          });
        }
      }
    } 
    // If moving backward, uncomplete steps after target
    else if (targetIndex < currentIndex) {
      for (let i = targetIndex; i < sortedSteps.length; i++) {
        if (sortedSteps[i].status === 'completed') {
          await updateStep.mutateAsync({
            id: sortedSteps[i].id,
            data: { 
              status: 'pending',
              completed_at: null
            }
          });
        }
      }
    }

    setDraggedProcess(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este processo?')) {
      onDeleteProcess?.(id);
    }
  };

  const getProcessesByColumn = (columnId: string) =>
    processes.filter((p) => getProcessColumn(p) === columnId);

  const getCompletedStepsCount = (process: ProcessWithDetails) => {
    if (!process.steps) return { completed: 0, total: 0 };
    return {
      completed: process.steps.filter(s => s.status === 'completed').length,
      total: process.steps.length
    };
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnProcesses = getProcessesByColumn(column.id);

        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${column.color}`} />
                <h3 className="font-medium text-sm truncate flex-1" title={column.name}>
                  {column.name}
                </h3>
                <Badge variant="secondary">
                  {columnProcesses.length}
                </Badge>
              </div>

              <div className="space-y-2 min-h-[200px]">
                {columnProcesses.map((process) => {
                  const stepProgress = getCompletedStepsCount(process);
                  
                  return (
                    <Card
                      key={process.id}
                      draggable
                      onDragStart={() => handleDragStart(process)}
                      className={`cursor-grab active:cursor-grabbing transition-opacity ${
                        draggedProcess?.id === process.id ? 'opacity-50' : ''
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{process.title}</h4>
                            {process.client && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <User className="h-3 w-3" />
                                <span className="truncate">{process.client.name}</span>
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditProcess?.(process)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(process.id)}
                                className="text-destructive"
                              >
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {stepProgress.total > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {stepProgress.completed}/{stepProgress.total} etapas
                              </span>
                              <span>{Math.round((stepProgress.completed / stepProgress.total) * 100)}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div 
                                className="bg-primary rounded-full h-1.5 transition-all"
                                style={{ width: `${(stepProgress.completed / stepProgress.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {process.started_at && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(process.started_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {columnProcesses.length === 0 && (
                  <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-lg text-muted-foreground text-xs">
                    Arraste processos aqui
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper to generate colors for steps
function getStepColor(index: number, total: number): string {
  const colors = [
    'bg-slate-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-amber-500',
    'bg-orange-500',
    'bg-green-500',
  ];
  
  // Last step is always green (completed)
  if (index === total - 1) return 'bg-green-500';
  
  return colors[index % (colors.length - 1)];
}
