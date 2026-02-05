import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, User, Calendar, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProcessWithDetails, useUpdateProcess, useDeleteProcess } from '@/hooks/useProcesses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types';

type ProcessStatus = Database['public']['Enums']['process_status'];

const STATUS_CONFIG: Record<ProcessStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-slate-500' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500' },
  awaiting_docs: { label: 'Aguardando Docs', color: 'bg-amber-500' },
  awaiting_client: { label: 'Aguardando Cliente', color: 'bg-orange-500' },
  completed: { label: 'Concluído', color: 'bg-green-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
};

const KANBAN_COLUMNS: ProcessStatus[] = [
  'pending',
  'in_progress',
  'awaiting_docs',
  'awaiting_client',
  'completed',
];

interface ProcessKanbanViewProps {
  processes: ProcessWithDetails[];
  onEditProcess?: (process: ProcessWithDetails) => void;
}

export function ProcessKanbanView({ processes, onEditProcess }: ProcessKanbanViewProps) {
  const updateProcess = useUpdateProcess();
  const deleteProcess = useDeleteProcess();
  const [draggedProcess, setDraggedProcess] = useState<ProcessWithDetails | null>(null);

  const handleDragStart = (process: ProcessWithDetails) => {
    setDraggedProcess(process);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: ProcessStatus) => {
    if (!draggedProcess || draggedProcess.status === status) {
      setDraggedProcess(null);
      return;
    }

    await updateProcess.mutateAsync({
      id: draggedProcess.id,
      data: {
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      },
    });

    setDraggedProcess(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este processo?')) {
      await deleteProcess.mutateAsync(id);
    }
  };

  const getProcessesByStatus = (status: ProcessStatus) =>
    processes.filter((p) => p.status === status);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const config = STATUS_CONFIG[status];
        const columnProcesses = getProcessesByStatus(status);

        return (
          <div
            key={status}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(status)}
          >
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${config.color}`} />
                <h3 className="font-medium text-sm">{config.label}</h3>
                <Badge variant="secondary" className="ml-auto">
                  {columnProcesses.length}
                </Badge>
              </div>

              <div className="space-y-2 min-h-[200px]">
                {columnProcesses.map((process) => (
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

                      {process.steps && process.steps.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>
                            {process.steps.filter((s) => s.status === 'completed').length}/
                            {process.steps.length} etapas
                          </span>
                        </div>
                      )}

                      {process.started_at && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(process.started_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

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
