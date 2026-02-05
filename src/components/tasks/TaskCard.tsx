import { Task, PriorityLevel } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Trash2, Edit2 } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const priorityColors: Record<PriorityLevel, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const priorityLabels: Record<PriorityLevel, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  compact?: boolean;
  showFrog?: boolean;
  showOrder?: number;
}

export function TaskCard({
  task,
  onComplete,
  onDelete,
  onEdit,
  compact = false,
  showFrog = false,
  showOrder,
}: TaskCardProps) {
  const isOverdue = () => {
    if (!task.due_date || task.status === 'completed') return false;
    const dueDate = parseISO(task.due_date);
    const today = new Date();
    // Comparar apenas as datas, sem considerar horário
    // Atrasado apenas se a data atual for DEPOIS do dia de vencimento
    return today.setHours(0, 0, 0, 0) > dueDate.setHours(23, 59, 59, 999);
  };

  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-sm ${
        isOverdue() ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : 'bg-card'
      } ${isCompleted ? 'opacity-60' : ''}`}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onComplete(task.id)}
        disabled={isCompleted}
      />

      {showOrder && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
          {showOrder}
        </div>
      )}

      {showFrog && task.is_frog && (
        <span className="text-xl">🐸</span>
      )}

      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </p>
        {!compact && task.description && (
          <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.client?.name && (
            <Badge variant="outline" className="text-xs">
              {task.client.name}
            </Badge>
          )}
          {task.due_date && (
            <span
              className={`text-xs flex items-center gap-1 ${
                isOverdue() ? 'text-red-600 font-medium' : 'text-muted-foreground'
              }`}
            >
              <Calendar className="h-3 w-3" />
              {format(parseISO(task.due_date), "dd 'de' MMM", { locale: ptBR })}
            </span>
          )}
          {task.is_important && (
            <Badge variant="secondary" className="text-xs">⭐ Importante</Badge>
          )}
          {task.is_urgent && (
            <Badge variant="destructive" className="text-xs">⚡ Urgente</Badge>
          )}
        </div>
      </div>

      <Badge className={priorityColors[task.priority]}>{priorityLabels[task.priority]}</Badge>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(task)}>
          <Edit2 className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
