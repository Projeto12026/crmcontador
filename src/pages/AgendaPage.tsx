import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTasks } from '@/hooks/useTasks';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday, parseISO,
  addWeeks, subWeeks, startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week';

export function AgendaPage() {
  const { data: tasks = [] } = useTasks();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    tasks.forEach((task) => {
      const dateKey = task.due_date || task.created_at?.slice(0, 10);
      if (dateKey) {
        const key = dateKey.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(task);
      }
    });
    return map;
  }, [tasks]);

  const days = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calStart, end: calEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, viewMode]);

  const navigate = (dir: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(dir === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(dir === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      case 'low': return 'bg-slate-400 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'in_progress': return '▶';
      case 'cancelled': return '✕';
      default: return '○';
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Agenda</h1>
          <p className="text-sm text-muted-foreground">Visualize suas tarefas no calendário</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-sm font-medium capitalize">
              {viewMode === 'month'
                ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
                : `Semana de ${format(days[0], "d 'de' MMM", { locale: ptBR })}`
              }
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('month')}
            >
              Mês
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('week')}
            >
              Semana
            </Button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekDays.map((day) => (
            <div key={day} className="border-r p-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className={cn(
          "grid grid-cols-7",
          viewMode === 'week' ? 'min-h-[400px]' : ''
        )}>
          {days.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const today = isToday(day);

            return (
              <div
                key={dateKey}
                className={cn(
                  "border-b border-r p-1 last:border-r-0",
                  viewMode === 'month' ? 'min-h-[100px]' : 'min-h-[350px]',
                  !isCurrentMonth && viewMode === 'month' && 'bg-muted/30',
                  today && 'bg-primary/5'
                )}
              >
                <div className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  today && 'bg-primary text-primary-foreground',
                  !today && !isCurrentMonth && 'text-muted-foreground/50',
                  !today && isCurrentMonth && 'text-foreground'
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, viewMode === 'month' ? 3 : 20).map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "group flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight transition-colors hover:bg-accent cursor-default",
                        task.status === 'completed' && 'line-through opacity-60'
                      )}
                      title={`${task.title}\nPrioridade: ${task.priority}\nStatus: ${task.status}`}
                    >
                      <span className="shrink-0">{statusIcon(task.status)}</span>
                      <span className="truncate">{task.title}</span>
                      <Badge
                        variant="secondary"
                        className={cn("ml-auto hidden shrink-0 px-1 py-0 text-[8px] group-hover:inline-flex", priorityColor(task.priority))}
                      >
                        {task.priority === 'urgent' ? '!!' : task.priority === 'high' ? '!' : ''}
                      </Badge>
                    </div>
                  ))}
                  {dayTasks.length > (viewMode === 'month' ? 3 : 20) && (
                    <div className="px-1 text-[10px] text-muted-foreground">
                      +{dayTasks.length - (viewMode === 'month' ? 3 : 20)} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Summary legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">○ Pendente</span>
        <span className="flex items-center gap-1">▶ Em andamento</span>
        <span className="flex items-center gap-1">✓ Concluída</span>
        <span className="flex items-center gap-1">✕ Cancelada</span>
        <span className="ml-auto">{tasks.length} tarefas no total</span>
      </div>
    </div>
  );
}
