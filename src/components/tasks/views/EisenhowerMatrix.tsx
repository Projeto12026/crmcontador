import { Task } from '@/types/crm';
import { TaskCard } from '../TaskCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EisenhowerMatrixProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export function EisenhowerMatrix({ tasks, onComplete, onDelete, onEdit }: EisenhowerMatrixProps) {
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  // Quadrant 1: Urgent + Important (Do First)
  const q1 = activeTasks.filter(t => t.is_urgent && t.is_important);
  // Quadrant 2: Not Urgent + Important (Schedule)
  const q2 = activeTasks.filter(t => !t.is_urgent && t.is_important);
  // Quadrant 3: Urgent + Not Important (Delegate)
  const q3 = activeTasks.filter(t => t.is_urgent && !t.is_important);
  // Quadrant 4: Not Urgent + Not Important (Eliminate)
  const q4 = activeTasks.filter(t => !t.is_urgent && !t.is_important);

  const renderQuadrant = (
    title: string,
    subtitle: string,
    taskList: Task[],
    bgColor: string,
    borderColor: string
  ) => (
    <Card className={`${bgColor} ${borderColor} border-2`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">({taskList.length})</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
        {taskList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa</p>
        ) : (
          taskList.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={onEdit}
              compact
            />
          ))
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">🎯 Matriz de Eisenhower</h3>
        <p className="text-sm text-muted-foreground">
          Organize suas tarefas por urgência e importância
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Row labels */}
        <div className="col-span-2 grid grid-cols-[auto_1fr_1fr] gap-4 items-center">
          <div></div>
          <div className="text-center font-medium text-sm">⚡ URGENTE</div>
          <div className="text-center font-medium text-sm">🕐 NÃO URGENTE</div>
        </div>

        {/* Important row */}
        <div className="col-span-2 grid grid-cols-[auto_1fr_1fr] gap-4">
          <div className="flex items-center">
            <span className="font-medium text-sm writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
              ⭐ IMPORTANTE
            </span>
          </div>
          {renderQuadrant(
            'FAZER AGORA',
            'Crises, prazos, problemas urgentes',
            q1,
            'bg-red-50 dark:bg-red-950/30',
            'border-red-300 dark:border-red-800'
          )}
          {renderQuadrant(
            'AGENDAR',
            'Planejamento, prevenção, desenvolvimento',
            q2,
            'bg-blue-50 dark:bg-blue-950/30',
            'border-blue-300 dark:border-blue-800'
          )}
        </div>

        {/* Not Important row */}
        <div className="col-span-2 grid grid-cols-[auto_1fr_1fr] gap-4">
          <div className="flex items-center">
            <span className="font-medium text-sm" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              ❌ NÃO IMPORTANTE
            </span>
          </div>
          {renderQuadrant(
            'DELEGAR',
            'Interrupções, algumas reuniões',
            q3,
            'bg-yellow-50 dark:bg-yellow-950/30',
            'border-yellow-300 dark:border-yellow-800'
          )}
          {renderQuadrant(
            'ELIMINAR',
            'Distrações, perda de tempo',
            q4,
            'bg-gray-50 dark:bg-gray-900/30',
            'border-gray-300 dark:border-gray-700'
          )}
        </div>
      </div>
    </div>
  );
}
