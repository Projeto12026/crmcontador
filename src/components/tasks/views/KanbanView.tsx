import { Task, TaskStatus } from '@/types/crm';
import { TaskCard } from '../TaskCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KanbanViewProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

const columns: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'pending', title: '📥 Pendente', color: 'border-t-slate-400' },
  { status: 'in_progress', title: '🔄 Em Andamento', color: 'border-t-blue-500' },
  { status: 'completed', title: '✅ Concluído', color: 'border-t-green-500' },
];

export function KanbanView({ tasks, onComplete, onDelete, onEdit, onStatusChange }: KanbanViewProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">📊 Kanban</h3>
        <p className="text-sm text-muted-foreground">
          Visualize o fluxo de trabalho em colunas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.status);
          
          return (
            <Card key={column.status} className={`border-t-4 ${column.color}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{column.title}</span>
                  <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
                {columnTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-[150px] border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">Nenhuma tarefa</p>
                  </div>
                ) : (
                  columnTasks.map(task => (
                    <div key={task.id} className="group relative">
                      <TaskCard
                        task={task}
                        onComplete={onComplete}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        compact
                      />
                      {/* Quick status change buttons */}
                      {column.status !== 'completed' && (
                        <div className="absolute top-1 right-16 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {column.status === 'pending' && (
                            <button
                              onClick={() => onStatusChange(task.id, 'in_progress')}
                              className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
                            >
                              Iniciar
                            </button>
                          )}
                          {column.status === 'in_progress' && (
                            <button
                              onClick={() => onComplete(task.id)}
                              className="text-xs bg-green-500 text-white px-2 py-0.5 rounded hover:bg-green-600"
                            >
                              Concluir
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
