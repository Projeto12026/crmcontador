import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction, FinancialCategory, TransactionFormData, FinancialStatus, TransactionType } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

export function useTransactions(filters?: { 
  status?: FinancialStatus; 
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('financial_transactions')
        .select('*, clients(id, name), financial_categories(id, name, color)')
        .order('due_date', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.startDate) {
        query = query.gte('due_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('due_date', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map(item => ({
        ...item,
        client: item.clients,
        category: item.financial_categories,
      })) as FinancialTransaction[];
    },
  });
}

export function useCategories(type?: TransactionType) {
  return useQuery({
    queryKey: ['financial_categories', type],
    queryFn: async () => {
      let query = supabase
        .from('financial_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (type) {
        query = query.eq('type', type);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialCategory[];
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const { data: result, error } = await supabase
        .from('financial_transactions')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result as FinancialTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Transação criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar transação', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FinancialTransaction> }) => {
      const updateData: Record<string, unknown> = { ...data };
      delete updateData.client;
      delete updateData.category;
      
      const { data: result, error } = await supabase
        .from('financial_transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as FinancialTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar transação', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error } = await supabase
        .from('financial_transactions')
        .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as FinancialTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Pagamento registrado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Transação excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir transação', description: error.message, variant: 'destructive' });
    },
  });
}
