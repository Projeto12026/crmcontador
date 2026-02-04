import { Task } from '@/types/crm';
import { TaskCard } from '../TaskCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface IvyLeeViewProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onSetIvyLeeOrder: (id: string, order: number | null) => void;
}

export function IvyLeeView({ tasks, onComplete, onDelete, onEdit, onSetIvyLeeOrder }: IvyLeeViewProps) {
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  
  // Tasks with Ivy Lee order (1-6)
  const ivyLeeTasks = activeTasks
    .filter(t => t.ivy_lee_order && t.ivy_lee_order >= 1 && t.ivy_lee_order <= 6)
    .sort((a, b) => (a.ivy_lee_order || 0) - (b.ivy_lee_order || 0));
  
  // Tasks without order
  const otherTasks = activeTasks.filter(t => !t.ivy_lee_order || t.ivy_lee_order < 1 || t.ivy_lee_order > 6);

  // Get next available slot
  const getNextSlot = (): number | null => {
    const usedSlots = ivyLeeTasks.map(t => t.ivy_lee_order);
    for (let i = 1; i <= 6; i++) {
      if (!usedSlots.includes(i)) return i;
    }
    return null;
  };

  const slots = [1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">6️⃣ Método Ivy Lee</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Ao final do dia, escreva as 6 tarefas mais importantes para amanhã, em ordem de prioridade. 
          Trabalhe uma de cada vez, sem pular.
        </p>
      </div>

      {/* The 6 Priority Slots */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Suas 6 Prioridades de Hoje
            <span className="text-sm font-normal text-muted-foreground">
              ({ivyLeeTasks.length}/6 definidas)
            </span>
          </CardTitle>
          <CardDescription>
            Complete uma tarefa por vez, na ordem. Não pule para a próxima até terminar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slots.map(slot => {
            const task = ivyLeeTasks.find(t => t.ivy_lee_order === slot);
            
            return (
              <div key={slot} className="flex items-stretch gap-3">
                <div
                  className={`flex h-auto min-h-[60px] w-12 items-center justify-center rounded-lg text-xl font-bold ${
                    task
                      ? slot === 1
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                      : 'bg-muted/50 text-muted-foreground border-2 border-dashed'
                  }`}
                >
                  {slot}
                </div>
                
                {task ? (
                  <div className="flex-1 relative group">
                    <TaskCard
                      task={task}
                      onComplete={onComplete}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      compact
                      showOrder={slot}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-28 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-8 w-8"
                      onClick={() => onSetIvyLeeOrder(task.id, null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
                    <span className="text-sm">Slot vazio — adicione uma tarefa abaixo</span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Available Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tarefas Disponíveis</span>
            <span className="text-sm font-normal text-muted-foreground">
              {otherTasks.length} tarefas
            </span>
          </CardTitle>
          <CardDescription>
            Adicione tarefas aos slots de prioridade acima
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {otherTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma tarefa disponível
            </p>
          ) : (
            otherTasks.map(task => {
              const nextSlot = getNextSlot();
              
              return (
                <div key={task.id} className="group relative">
                  <TaskCard
                    task={task}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    compact
                  />
                  {nextSlot && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-primary/10 hover:bg-primary/20"
                      onClick={() => onSetIvyLeeOrder(task.id, nextSlot)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Slot {nextSlot}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
