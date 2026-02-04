import { Task, TaskStatus } from '@/types/crm';
import { TaskCard } from '../TaskCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ListViewProps {
  tasks: Task[];
  filter: TaskStatus | 'all';
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export function ListView({ tasks, filter, onComplete, onDelete, onEdit }: ListViewProps) {
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="space-y-6">
      {filter !== 'completed' && pendingTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pendentes ({pendingTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {(filter === 'all' || filter === 'completed') && completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Concluídas ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedTasks.slice(0, 10).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma tarefa encontrada
        </div>
      )}
    </div>
  );
}
