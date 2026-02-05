import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Contract, ContractFormData, ContractStatus, ContractManager, TaxType } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

interface ContractFilters {
  status?: ContractStatus;
  manager?: ContractManager;
  taxType?: TaxType;
}

export function useContracts(filters?: ContractFilters) {
  return useQuery({
    queryKey: ['contracts', filters],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select('*, clients(id, name)')
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.manager) {
        query = query.eq('manager', filters.manager);
      }
      if (filters?.taxType) {
        query = query.eq('tax_type', filters.taxType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map(item => ({
        ...item,
        client: item.clients,
      })) as Contract[];
    },
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ContractFormData) => {
      const { data: result, error } = await supabase
        .from('contracts')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result as Contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contrato criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar contrato', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contract> }) => {
      const updateData: Record<string, unknown> = { ...data };
      delete updateData.client;
      delete updateData.services;
      
      const { data: result, error } = await supabase
        .from('contracts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contrato atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar contrato', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contrato excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir contrato', description: error.message, variant: 'destructive' });
    },
  });
}
