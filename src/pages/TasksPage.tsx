import { useState } from 'react';
import { useTasks, useCreateTask, useCompleteTask, useDeleteTask, useUpdateTask, useUpdateTaskStatus } from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';
import { Task, TaskStatus, TaskViewType, taskViewLabels, TaskFormData as CrmTaskFormData } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2 } from 'lucide-react';

// Views
import { ListView } from '@/components/tasks/views/ListView';
import { EisenhowerMatrix } from '@/components/tasks/views/EisenhowerMatrix';
import { KanbanView } from '@/components/tasks/views/KanbanView';
import { TwoListsView } from '@/components/tasks/views/TwoListsView';
import { EatTheFrogView } from '@/components/tasks/views/EatTheFrogView';
import { IvyLeeView } from '@/components/tasks/views/IvyLeeView';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export function TasksPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [activeView, setActiveView] = useState<TaskViewType>('list');

  const { data: tasks, isLoading } = useTasks(filter === 'all' ? undefined : { status: filter });
  const { data: clients } = useClients();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();

  // Filter tasks by enabled_views for current view
  const filteredTasks = tasks?.filter(t => 
    t.enabled_views?.includes(activeView) ?? true
  ) || [];

  const handleSubmit = async (data: CrmTaskFormData) => {
    if (editingTask) {
      await updateTask.mutateAsync({ id: editingTask.id, data });
    } else {
      await createTask.mutateAsync(data);
    }
    setEditingTask(null);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleComplete = (id: string) => {
    completeTask.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteTask.mutate(id);
  };

  const handleStatusChange = (id: string, status: TaskStatus) => {
    updateStatus.mutate({ id, status });
  };

  const handleToggleFocusList = (id: string, isFocusList: boolean) => {
    updateTask.mutate({ id, data: { is_focus_list: isFocusList } });
  };

  const handleSetFrog = (id: string, isFrog: boolean) => {
    // If setting a new frog, unset any existing frog first
    if (isFrog) {
      const currentFrog = tasks?.find(t => t.is_frog);
      if (currentFrog) {
        updateTask.mutate({ id: currentFrog.id, data: { is_frog: false } });
      }
    }
    updateTask.mutate({ id, data: { is_frog: isFrog } });
  };

  const handleSetIvyLeeOrder = (id: string, order: number | null) => {
    updateTask.mutate({ id, data: { ivy_lee_order: order } });
  };

  const openNewTaskForm = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie suas atividades com diferentes estratégias de produtividade</p>
        </div>
        <Button onClick={openNewTaskForm}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as TaskViewType)}>
        <TabsList className="grid w-full grid-cols-6">
          {(Object.keys(taskViewLabels) as TaskViewType[]).map((view) => (
            <TabsTrigger key={view} value={view} className="text-xs sm:text-sm">
              <span className="hidden sm:inline">{taskViewLabels[view].icon}</span>
              <span className="ml-1 truncate">{taskViewLabels[view].label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Status Filter (only for list view) */}
        {activeView === 'list' && (
          <div className="flex gap-2 mt-4">
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
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="list" className="mt-4">
              <ListView
                tasks={filteredTasks}
                filter={filter}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            </TabsContent>

            <TabsContent value="eisenhower" className="mt-4">
              <EisenhowerMatrix
                tasks={filteredTasks}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            </TabsContent>

            <TabsContent value="kanban" className="mt-4">
              <KanbanView
                tasks={filteredTasks}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
              />
            </TabsContent>

            <TabsContent value="two_lists" className="mt-4">
              <TwoListsView
                tasks={filteredTasks}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onToggleFocusList={handleToggleFocusList}
              />
            </TabsContent>

            <TabsContent value="eat_frog" className="mt-4">
              <EatTheFrogView
                tasks={filteredTasks}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onSetFrog={handleSetFrog}
              />
            </TabsContent>

            <TabsContent value="ivy_lee" className="mt-4">
              <IvyLeeView
                tasks={filteredTasks}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onSetIvyLeeOrder={handleSetIvyLeeOrder}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <TaskFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        clients={clients || []}
        onSubmit={handleSubmit}
        isLoading={createTask.isPending || updateTask.isPending}
      />
    </div>
  );
}
