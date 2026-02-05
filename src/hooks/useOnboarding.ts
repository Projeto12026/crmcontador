import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: OnboardingTemplateItem[];
}

export interface OnboardingTemplateItem {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
}

export interface ClientOnboarding {
  id: string;
  client_id: string;
  template_id: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string };
  template?: { id: string; name: string };
  items?: ClientOnboardingItem[];
}

export interface ClientOnboardingItem {
  id: string;
  onboarding_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Templates
export function useOnboardingTemplates() {
  return useQuery({
    queryKey: ['onboarding-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_templates')
        .select('*, onboarding_template_items(*)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return data.map((t) => ({
        ...t,
        items: t.onboarding_template_items?.sort((a: OnboardingTemplateItem, b: OnboardingTemplateItem) => a.order_index - b.order_index),
      })) as OnboardingTemplate[];
    },
  });
}

export function useCreateOnboardingTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; items: { title: string; description?: string }[] }) => {
      // Create template
      const { data: template, error: templateError } = await supabase
        .from('onboarding_templates')
        .insert({ name: data.name, description: data.description })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create items
      if (data.items.length > 0) {
        const items = data.items.map((item, index) => ({
          template_id: template.id,
          title: item.title,
          description: item.description,
          order_index: index + 1,
        }));

        const { error: itemsError } = await supabase
          .from('onboarding_template_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-templates'] });
      toast({ title: 'Template criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar template', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteOnboardingTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('onboarding_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-templates'] });
      toast({ title: 'Template removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover template', description: error.message, variant: 'destructive' });
    },
  });
}

// Client Onboardings
export function useClientOnboardings(status?: 'pending' | 'in_progress' | 'completed') {
  return useQuery({
    queryKey: ['client-onboardings', status],
    queryFn: async () => {
      let query = supabase
        .from('client_onboarding')
        .select(`
          *,
          clients(id, name),
          onboarding_templates(id, name),
          client_onboarding_items(*)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((o) => ({
        ...o,
        client: o.clients,
        template: o.onboarding_templates,
        items: o.client_onboarding_items?.sort((a: ClientOnboardingItem, b: ClientOnboardingItem) => a.order_index - b.order_index),
      })) as ClientOnboarding[];
    },
  });
}

export function useClientOnboarding(id: string) {
  return useQuery({
    queryKey: ['client-onboarding', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_onboarding')
        .select(`
          *,
          clients(id, name),
          onboarding_templates(id, name),
          client_onboarding_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        client: data.clients,
        template: data.onboarding_templates,
        items: data.client_onboarding_items?.sort((a: ClientOnboardingItem, b: ClientOnboardingItem) => a.order_index - b.order_index),
      } as ClientOnboarding;
    },
    enabled: !!id,
  });
}

export function useStartOnboarding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { client_id: string; template_id: string }) => {
      // Get template items
      const { data: templateItems, error: itemsError } = await supabase
        .from('onboarding_template_items')
        .select('*')
        .eq('template_id', data.template_id)
        .order('order_index');

      if (itemsError) throw itemsError;

      // Create onboarding
      const { data: onboarding, error: onboardingError } = await supabase
        .from('client_onboarding')
        .insert({
          client_id: data.client_id,
          template_id: data.template_id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (onboardingError) throw onboardingError;

      // Create onboarding items from template
      if (templateItems && templateItems.length > 0) {
        const items = templateItems.map((item) => ({
          onboarding_id: onboarding.id,
          title: item.title,
          description: item.description,
          order_index: item.order_index,
          is_completed: false,
        }));

        const { error: createItemsError } = await supabase
          .from('client_onboarding_items')
          .insert(items);

        if (createItemsError) throw createItemsError;
      }

      return onboarding;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-onboardings'] });
      toast({ title: 'Onboarding iniciado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao iniciar onboarding', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateOnboardingItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientOnboardingItem> }) => {
      const { data: result, error } = await supabase
        .from('client_onboarding_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-onboardings'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar item', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('client_onboarding')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-onboardings'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
      toast({ title: 'Onboarding concluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao concluir onboarding', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteOnboarding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete items first
      await supabase
        .from('client_onboarding_items')
        .delete()
        .eq('onboarding_id', id);

      // Delete onboarding
      const { error } = await supabase
        .from('client_onboarding')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-onboardings'] });
      toast({ title: 'Onboarding removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover onboarding', description: error.message, variant: 'destructive' });
    },
  });
}
