import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Process = Tables<'processes'>;
type ProcessStep = Tables<'process_steps'>;
type ProcessTemplate = Tables<'process_templates'>;
type ProcessTemplateStep = Tables<'process_template_steps'>;

export type ProcessWithDetails = Process & {
  client?: Tables<'clients'> | null;
  steps?: ProcessStep[];
  template?: ProcessTemplate | null;
};

export function useProcesses(subprocess?: string) {
  return useQuery({
    queryKey: ['processes', subprocess],
    queryFn: async () => {
      let query = supabase
        .from('processes')
        .select(`
          *,
          client:clients(*),
          steps:process_steps(*),
          template:process_templates(*)
        `)
        .order('created_at', { ascending: false });

      // Filter by subprocess type if provided (stored in description or title pattern)
      if (subprocess) {
        query = query.ilike('title', `%${subprocess}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProcessWithDetails[];
    },
  });
}

export function useProcessTemplates() {
  return useQuery({
    queryKey: ['process-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_templates')
        .select(`
          *,
          steps:process_template_steps(*)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as (ProcessTemplate & { steps: ProcessTemplateStep[] })[];
    },
  });
}

export function useCreateProcess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: TablesInsert<'processes'> & { templateId?: string }) => {
      const { templateId, ...processData } = data;
      
      // Create the process
      const { data: process, error: processError } = await supabase
        .from('processes')
        .insert({
          ...processData,
          template_id: templateId || null,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (processError) throw processError;

      // If template provided, copy steps from template
      if (templateId) {
        const { data: templateSteps } = await supabase
          .from('process_template_steps')
          .select('*')
          .eq('template_id', templateId)
          .order('order_index');

        if (templateSteps && templateSteps.length > 0) {
          const processSteps = templateSteps.map((step) => ({
            process_id: process.id,
            name: step.name,
            description: step.description,
            order_index: step.order_index,
            status: 'pending' as const,
          }));

          await supabase.from('process_steps').insert(processSteps);
        }
      }

      return process;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast({ title: 'Processo criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar processo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateProcess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TablesUpdate<'processes'> }) => {
      const { data: result, error } = await supabase
        .from('processes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast({ title: 'Processo atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar processo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateProcessStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TablesUpdate<'process_steps'> }) => {
      const { data: result, error } = await supabase
        .from('process_steps')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useDeleteProcess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete steps first
      await supabase.from('process_steps').delete().eq('process_id', id);
      
      const { error } = await supabase.from('processes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast({ title: 'Processo excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir processo', description: error.message, variant: 'destructive' });
    },
  });
}

// Template management
export function useCreateProcessTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; steps: { name: string; description?: string; estimated_days?: number }[] }) => {
      const { data: template, error: templateError } = await supabase
        .from('process_templates')
        .insert({ name: data.name, description: data.description })
        .select()
        .single();

      if (templateError) throw templateError;

      if (data.steps.length > 0) {
        const steps = data.steps.map((step, index) => ({
          template_id: template.id,
          name: step.name,
          description: step.description,
          estimated_days: step.estimated_days,
          order_index: index,
        }));

        await supabase.from('process_template_steps').insert(steps);
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-templates'] });
      toast({ title: 'Modelo de processo criado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar modelo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateProcessTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: { name: string; description?: string; steps: { id?: string; name: string; description?: string; estimated_days?: number }[] } 
    }) => {
      // Update template
      await supabase
        .from('process_templates')
        .update({ name: data.name, description: data.description })
        .eq('id', id);

      // Delete old steps and insert new ones
      await supabase.from('process_template_steps').delete().eq('template_id', id);

      if (data.steps.length > 0) {
        const steps = data.steps.map((step, index) => ({
          template_id: id,
          name: step.name,
          description: step.description,
          estimated_days: step.estimated_days,
          order_index: index,
        }));

        await supabase.from('process_template_steps').insert(steps);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-templates'] });
      toast({ title: 'Modelo atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar modelo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteProcessTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('process_template_steps').delete().eq('template_id', id);
      const { error } = await supabase.from('process_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-templates'] });
      toast({ title: 'Modelo excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir modelo', description: error.message, variant: 'destructive' });
    },
  });
}
