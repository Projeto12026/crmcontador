import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskFormData, TaskStatus, TaskViewType } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

export function useTasks(filters?: { status?: TaskStatus; clientId?: string }) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, clients(id, name)')
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map(item => ({
        ...item,
        client: item.clients,
        // Ensure boolean fields have default values
        is_important: item.is_important ?? false,
        is_urgent: item.is_urgent ?? false,
        is_frog: item.is_frog ?? false,
        is_focus_list: item.is_focus_list ?? false,
        ivy_lee_order: item.ivy_lee_order ?? null,
        enabled_views: (item.enabled_views as TaskViewType[]) ?? ['list', 'eisenhower', 'kanban', 'two_lists', 'eat_frog', 'ivy_lee'],
      })) as Task[];
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { data: result, error } = await supabase
        .from('tasks')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      
      // Send to Zapier if webhook is configured
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'zapier_webhook_url')
        .single();

      if (settings?.value && typeof settings.value === 'object' && 'webhookUrl' in settings.value) {
        const webhookUrl = (settings.value as any).webhookUrl;
        try {
          await supabase.functions.invoke('send-task-to-zapier', {
            body: {
              webhookUrl,
              task: {
                title: result.title,
                description: result.description,
                due_date: result.due_date,
                priority: result.priority,
                status: result.status,
              },
            },
          });
        } catch (zapierError) {
          console.error('Error sending task to Zapier:', zapierError);
          // Don't fail the task creation if Zapier sync fails
        }
      }
      
      return result as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tarefa criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar tarefa', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const updateData: Record<string, unknown> = { ...data };
      delete updateData.client;
      
      const { data: result, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar tarefa', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tarefa concluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao concluir tarefa', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tarefa excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir tarefa', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { data: result, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    },
  });
}
