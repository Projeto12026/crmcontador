import { useState } from 'react';
import { useTasks, useCreateTask, useCompleteTask, useDeleteTask } from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';
import { Task, TaskStatus, PriorityLevel } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calendar, Loader2 } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const priorityColors: Record<PriorityLevel, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const priorityLabels: Record<PriorityLevel, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export function TasksPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [dueDate, setDueDate] = useState('');

  const { data: tasks, isLoading } = useTasks(filter === 'all' ? undefined : { status: filter });
  const { data: clients } = useClients();
  const createTask = useCreateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask.mutateAsync({
      title,
      description: description || undefined,
      client_id: clientId || undefined,
      priority,
      due_date: dueDate || undefined,
    });
    setIsOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClientId('');
    setPriority('medium');
    setDueDate('');
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'completed') return false;
    return isAfter(new Date(), parseISO(task.due_date));
  };

  const pendingTasks = tasks?.filter(t => t.status === 'pending' || t.status === 'in_progress') || [];
  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie suas atividades</p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status === 'all' ? 'Todas' : statusLabels[status]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {filter !== 'completed' && pendingTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pendentes ({pendingTasks.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-4 rounded-lg border p-4 ${
                      isOverdue(task) ? 'border-red-300 bg-red-50 dark:bg-red-950' : ''
                    }`}
                  >
                    <Checkbox
                      checked={task.status === 'completed'}
                      onCheckedChange={() => completeTask.mutate(task.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.client?.name && (
                          <Badge variant="outline" className="text-xs">
                            {task.client.name}
                          </Badge>
                        )}
                        {task.due_date && (
                          <span className={`text-xs flex items-center gap-1 ${
                            isOverdue(task) ? 'text-red-600 font-medium' : 'text-muted-foreground'
                          }`}>
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(task.due_date), "dd 'de' MMM", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={priorityColors[task.priority]}>
                      {priorityLabels[task.priority]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTask.mutate(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
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
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-lg border p-4 opacity-60"
                  >
                    <Checkbox checked disabled />
                    <div className="flex-1">
                      <p className="font-medium line-through">{task.title}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTask.mutate(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tasks?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma tarefa encontrada
            </div>
          )}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Descrição da tarefa"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as PriorityLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
