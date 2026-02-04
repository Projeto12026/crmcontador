import { Task } from '@/types/crm';
import { TaskCard } from '../TaskCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EatTheFrogViewProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onSetFrog: (id: string, isFrog: boolean) => void;
}

export function EatTheFrogView({ tasks, onComplete, onDelete, onEdit, onSetFrog }: EatTheFrogViewProps) {
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const frogTask = activeTasks.find(t => t.is_frog);
  const otherTasks = activeTasks.filter(t => !t.is_frog);

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">🐸 Coma o Sapo</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          "Se você tem que comer um sapo, é melhor fazê-lo logo pela manhã. 
          E se tiver que comer dois, coma o maior primeiro." — Mark Twain
        </p>
      </div>

      {/* The Frog */}
      <Card className="border-4 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-2xl">
              🐸
            </div>
            Seu Sapo do Dia
          </CardTitle>
          <CardDescription className="text-base">
            A tarefa mais difícil ou importante que você está evitando
          </CardDescription>
        </CardHeader>
        <CardContent>
          {frogTask ? (
            <div className="relative">
              <TaskCard
                task={frogTask}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
                showFrog
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onSetFrog(frogTask.id, false)}
              >
                Remover como Sapo
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg">
              <span className="text-6xl mb-4">🐸</span>
              <p className="text-lg font-medium text-green-700 dark:text-green-400">
                Nenhum sapo selecionado
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha uma tarefa abaixo para ser seu sapo de hoje
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Outras Tarefas</span>
            <span className="text-sm font-normal text-muted-foreground">
              {otherTasks.length} tarefas
            </span>
          </CardTitle>
          <CardDescription>
            Escolha uma tarefa para ser seu "sapo" — a mais difícil ou que você está adiando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {otherTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma outra tarefa pendente
            </p>
          ) : (
            otherTasks.map(task => (
              <div key={task.id} className="group relative">
                <TaskCard
                  task={task}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  compact
                />
                {!frogTask && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-accent hover:bg-accent/80"
                    onClick={() => onSetFrog(task.id, true)}
                  >
                    🐸 Fazer Sapo
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
