import { Task } from '@/types/crm';
import { TaskCard } from '../TaskCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface TwoListsViewProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onToggleFocusList: (id: string, isFocusList: boolean) => void;
}

export function TwoListsView({ tasks, onComplete, onDelete, onEdit, onToggleFocusList }: TwoListsViewProps) {
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const focusTasks = activeTasks.filter(t => t.is_focus_list);
  const backlogTasks = activeTasks.filter(t => !t.is_focus_list);

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">📋 Estratégia das Duas Listas</h3>
        <p className="text-sm text-muted-foreground">
          Warren Buffett: Foque nas 5-7 tarefas mais importantes e ignore o resto até concluí-las
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Focus List */}
        <Card className="border-2 border-green-500 dark:border-green-700">
          <CardHeader className="bg-green-50 dark:bg-green-950/30">
            <CardTitle className="text-lg flex items-center gap-2">
              🎯 Lista de Foco
              <span className="text-sm font-normal bg-green-200 dark:bg-green-800 px-2 py-0.5 rounded-full">
                {focusTasks.length}/7
              </span>
            </CardTitle>
            <CardDescription>
              Suas prioridades absolutas. Não adicione mais de 7 itens!
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 min-h-[300px]">
            {focusTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] border-2 border-dashed rounded-lg p-4">
                <p className="text-muted-foreground text-center">
                  Mova tarefas importantes do backlog para cá
                </p>
              </div>
            ) : (
              focusTasks.map(task => (
                <div key={task.id} className="group relative">
                  <TaskCard
                    task={task}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    compact
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                    onClick={() => onToggleFocusList(task.id, false)}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Backlog
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Backlog */}
        <Card className="border-2 border-gray-300 dark:border-gray-700">
          <CardHeader className="bg-gray-50 dark:bg-gray-900/30">
            <CardTitle className="text-lg flex items-center gap-2">
              📦 Backlog
              <span className="text-sm font-normal bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {backlogTasks.length}
              </span>
            </CardTitle>
            <CardDescription>
              Evite ativamente estas tarefas até terminar a Lista de Foco
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 min-h-[300px] max-h-[500px] overflow-y-auto">
            {backlogTasks.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">Nenhuma tarefa no backlog</p>
              </div>
            ) : (
              backlogTasks.map(task => (
                <div key={task.id} className="group relative">
                  <TaskCard
                    task={task}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    compact
                  />
                  {focusTasks.length < 7 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                      onClick={() => onToggleFocusList(task.id, true)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Foco
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
