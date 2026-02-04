import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadFormData, LeadStatus } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

export function useLeads(status?: LeadStatus) {
  return useQuery({
    queryKey: ['leads', status],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: LeadFormData) => {
      const { data: result, error } = await supabase
        .from('leads')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Lead> }) => {
      const { data: result, error } = await supabase
        .from('leads')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar lead', description: error.message, variant: 'destructive' });
    },
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (leadId: string) => {
      // Get lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      if (leadError) throw leadError;

      // Create client from lead
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: lead.company_name,
          email: lead.email,
          phone: lead.phone,
          notes: lead.notes,
        })
        .select()
        .single();
      
      if (clientError) throw clientError;

      // Update lead status
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: 'won', converted_client_id: client.id })
        .eq('id', leadId);
      
      if (updateError) throw updateError;

      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Lead convertido em cliente!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao converter lead', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir lead', description: error.message, variant: 'destructive' });
    },
  });
}
