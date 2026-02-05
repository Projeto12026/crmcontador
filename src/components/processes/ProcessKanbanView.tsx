import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MoreHorizontal, User, Calendar, CheckCircle2, Plus, 
  Pencil, Trash2, GripVertical, X, Check, Settings2 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ProcessWithDetails, useUpdateProcessStep, useProcessTemplates, useUpdateProcessTemplate } from '@/hooks/useProcesses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type ProcessStep = Tables<'process_steps'>;
type ProcessTemplateStep = Tables<'process_template_steps'>;

interface Column {
  id: string;
  name: string;
  order: number;
  color: string;
}

interface ProcessKanbanViewProps {
  processes: ProcessWithDetails[];
  subprocessLabel?: string;
  onEditProcess?: (process: ProcessWithDetails) => void;
  onDeleteProcess?: (id: string) => void;
}

export function ProcessKanbanView({ processes, subprocessLabel, onEditProcess, onDeleteProcess }: ProcessKanbanViewProps) {
  const { data: templates = [] } = useProcessTemplates();
  const updateTemplate = useUpdateProcessTemplate();
  const updateStep = useUpdateProcessStep();
  const { toast } = useToast();
  
  const [draggedProcess, setDraggedProcess] = useState<ProcessWithDetails | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [showNewColumnInput, setShowNewColumnInput] = useState(false);

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
    
    return [
      { id: 'pending', name: 'Pendente', order: 0, color: 'bg-slate-500' },
      { id: 'in_progress', name: 'Em Andamento', order: 1, color: 'bg-blue-500' },
      { id: 'completed', name: 'Concluído', order: 2, color: 'bg-green-500' },
    ];
  }, [activeTemplate]);

  // Save columns to template
  const saveColumns = async (newColumns: { name: string; description?: string; estimated_days?: number }[]) => {
    if (!activeTemplate) {
      toast({ title: 'Nenhum modelo vinculado', description: 'Crie um modelo de processo primeiro.', variant: 'destructive' });
      return;
    }

    try {
      await updateTemplate.mutateAsync({
        id: activeTemplate.id,
        data: {
          name: activeTemplate.name,
          description: activeTemplate.description || undefined,
          steps: newColumns.map((col, index) => ({
            name: col.name,
            description: col.description,
            estimated_days: col.estimated_days,
          })),
        },
      });
      toast({ title: 'Etapas atualizadas!' });
    } catch (error) {
      toast({ title: 'Erro ao salvar etapas', variant: 'destructive' });
    }
  };

  // Add new column
  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    
    const existingSteps = activeTemplate?.steps || [];
    const newSteps = [
      ...existingSteps.map(s => ({ name: s.name, description: s.description || undefined, estimated_days: s.estimated_days || undefined })),
      { name: newColumnName.trim() }
    ];
    
    await saveColumns(newSteps);
    setNewColumnName('');
    setShowNewColumnInput(false);
  };

  // Edit column name
  const handleEditColumn = async (columnId: string) => {
    if (!editingColumnName.trim() || !activeTemplate) return;
    
    const newSteps = activeTemplate.steps.map(s => ({
      name: s.id === columnId ? editingColumnName.trim() : s.name,
      description: s.description || undefined,
      estimated_days: s.estimated_days || undefined,
    }));
    
    await saveColumns(newSteps);
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  // Delete column
  const handleDeleteColumn = async (columnId: string) => {
    if (!activeTemplate) return;
    
    const columnProcesses = getProcessesByColumn(columnId);
    if (columnProcesses.length > 0) {
      toast({ 
        title: 'Não é possível excluir', 
        description: 'Mova os processos para outra etapa primeiro.', 
        variant: 'destructive' 
      });
      return;
    }
    
    const newSteps = activeTemplate.steps
      .filter(s => s.id !== columnId)
      .map(s => ({
        name: s.name,
        description: s.description || undefined,
        estimated_days: s.estimated_days || undefined,
      }));
    
    await saveColumns(newSteps);
  };

  // Reorder columns via drag
  const handleColumnDragStart = (columnId: string) => {
    setDraggedColumnId(columnId);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleColumnDrop = async (targetColumnId: string) => {
    if (!draggedColumnId || draggedColumnId === targetColumnId || !activeTemplate) {
      setDraggedColumnId(null);
      return;
    }

    const sortedSteps = [...activeTemplate.steps].sort((a, b) => a.order_index - b.order_index);
    const draggedIndex = sortedSteps.findIndex(s => s.id === draggedColumnId);
    const targetIndex = sortedSteps.findIndex(s => s.id === targetColumnId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumnId(null);
      return;
    }

    // Reorder array
    const [removed] = sortedSteps.splice(draggedIndex, 1);
    sortedSteps.splice(targetIndex, 0, removed);

    const newSteps = sortedSteps.map(s => ({
      name: s.name,
      description: s.description || undefined,
      estimated_days: s.estimated_days || undefined,
    }));

    await saveColumns(newSteps);
    setDraggedColumnId(null);
  };

  // Determine which column a process belongs to
  const getProcessColumn = (process: ProcessWithDetails): string => {
    if (!process.steps || process.steps.length === 0) {
      return columns[0]?.id || 'pending';
    }

    const sortedSteps = [...process.steps].sort((a, b) => a.order_index - b.order_index);
    const currentStep = sortedSteps.find(s => s.status !== 'completed');
    
    if (!currentStep) {
      return columns[columns.length - 1]?.id || 'completed';
    }

    const matchingColumn = columns.find(col => 
      col.name.toLowerCase() === currentStep.name.toLowerCase()
    );
    
    if (matchingColumn) return matchingColumn.id;

    const columnByOrder = columns[currentStep.order_index];
    if (columnByOrder) return columnByOrder.id;

    return columns[0]?.id || 'pending';
  };

  const handleProcessDragStart = (process: ProcessWithDetails) => {
    if (editMode) return; // Don't allow process drag in edit mode
    setDraggedProcess(process);
  };

  const handleProcessDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleProcessDrop = async (targetColumnId: string) => {
    if (editMode || !draggedProcess) {
      setDraggedProcess(null);
      return;
    }

    const currentColumn = getProcessColumn(draggedProcess);
    if (currentColumn === targetColumnId) {
      setDraggedProcess(null);
      return;
    }

    const targetIndex = columns.findIndex(c => c.id === targetColumnId);
    const currentIndex = columns.findIndex(c => c.id === currentColumn);

    if (targetIndex === -1 || !draggedProcess.steps) {
      setDraggedProcess(null);
      return;
    }

    const sortedSteps = [...draggedProcess.steps].sort((a, b) => a.order_index - b.order_index);

    if (targetIndex > currentIndex) {
      for (let i = 0; i <= targetIndex && i < sortedSteps.length; i++) {
        if (i < targetIndex && sortedSteps[i].status !== 'completed') {
          await updateStep.mutateAsync({
            id: sortedSteps[i].id,
            data: { status: 'completed', completed_at: new Date().toISOString() }
          });
        }
      }
    } else if (targetIndex < currentIndex) {
      for (let i = targetIndex; i < sortedSteps.length; i++) {
        if (sortedSteps[i].status === 'completed') {
          await updateStep.mutateAsync({
            id: sortedSteps[i].id,
            data: { status: 'pending', completed_at: null }
          });
        }
      }
    }

    setDraggedProcess(null);
  };

  const handleDeleteProcess = async (id: string) => {
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
    <div className="space-y-4">
      {/* Edit Mode Toggle */}
      <div className="flex justify-end">
        <Button
          variant={editMode ? "default" : "outline"}
          size="sm"
          onClick={() => setEditMode(!editMode)}
        >
          <Settings2 className="h-4 w-4 mr-2" />
          {editMode ? 'Concluir Edição' : 'Editar Etapas'}
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column, index) => {
          const columnProcesses = getProcessesByColumn(column.id);
          const isEditing = editingColumnId === column.id;

          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-72 ${editMode ? 'cursor-grab' : ''} ${
                draggedColumnId === column.id ? 'opacity-50' : ''
              }`}
              draggable={editMode}
              onDragStart={() => editMode && handleColumnDragStart(column.id)}
              onDragOver={editMode ? handleColumnDragOver : handleProcessDragOver}
              onDrop={() => editMode ? handleColumnDrop(column.id) : handleProcessDrop(column.id)}
            >
              <div className="bg-muted/50 rounded-lg p-3">
                {/* Column Header */}
                <div className="flex items-center gap-2 mb-3">
                  {editMode && (
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  )}
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-1">
                      <Input
                        value={editingColumnName}
                        onChange={(e) => setEditingColumnName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditColumn(column.id);
                          if (e.key === 'Escape') {
                            setEditingColumnId(null);
                            setEditingColumnName('');
                          }
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditColumn(column.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                        setEditingColumnId(null);
                        setEditingColumnName('');
                      }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-medium text-sm truncate flex-1" title={column.name}>
                        {column.name}
                      </h3>
                      {editMode ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingColumnId(column.id);
                              setEditingColumnName(column.name);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => handleDeleteColumn(column.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary">
                          {columnProcesses.length}
                        </Badge>
                      )}
                    </>
                  )}
                </div>

                {/* Processes */}
                <div className="space-y-2 min-h-[200px]">
                  {columnProcesses.map((process) => {
                    const stepProgress = getCompletedStepsCount(process);
                    
                    return (
                      <Card
                        key={process.id}
                        draggable={!editMode}
                        onDragStart={() => handleProcessDragStart(process)}
                        className={`${!editMode ? 'cursor-grab active:cursor-grabbing' : ''} transition-opacity ${
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
                                  onClick={() => handleDeleteProcess(process.id)}
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

                  {columnProcesses.length === 0 && !editMode && (
                    <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-lg text-muted-foreground text-xs">
                      Arraste processos aqui
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add New Column */}
        {editMode && (
          <div className="flex-shrink-0 w-72">
            <div className="bg-muted/30 rounded-lg p-3 border-2 border-dashed">
              {showNewColumnInput ? (
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Nome da etapa"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddColumn();
                      if (e.key === 'Escape') {
                        setShowNewColumnInput(false);
                        setNewColumnName('');
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddColumn} className="flex-1">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setShowNewColumnInput(false);
                      setNewColumnName('');
                    }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-20 flex flex-col gap-2"
                  onClick={() => setShowNewColumnInput(true)}
                >
                  <Plus className="h-6 w-6" />
                  <span>Adicionar Etapa</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  
  if (index === total - 1) return 'bg-green-500';
  
  return colors[index % (colors.length - 1)];
}
