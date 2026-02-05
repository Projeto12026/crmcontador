import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PayrollObligationStatus = 'pending' | 'delayed' | 'completed';

export interface PayrollObligation {
  id: string;
  client_id: string | null;
  client_name: string;
  client_cnpj: string;
  client_status: string;
  department: string;
  obligation_name: string;
  competence: string;
  due_date: string | null;
  status: PayrollObligationStatus;
  completed_at: string | null;
  notes: string | null;
  gclick_id: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all payroll obligations
export function usePayrollObligations() {
  return useQuery({
    queryKey: ['payroll-obligations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_obligations')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as PayrollObligation[];
    },
  });
}

// Update obligation status
export function useUpdateObligationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PayrollObligationStatus }) => {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('payroll_obligations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-obligations'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

// Mark multiple obligations as completed
export function useBatchCompleteObligations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('payroll_obligations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-obligations'] });
      toast.success('Obrigações concluídas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao concluir obrigações: ' + error.message);
    },
  });
}

// Sync with G-Click API
export function useSyncGClick() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-gclick-obligations', {
        body: { type: 'folha_pagamento' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-obligations'] });
      toast.success(`Sincronização concluída! ${data?.synced || 0} obrigações atualizadas.`);
    },
    onError: (error) => {
      toast.error('Erro ao sincronizar com G-Click: ' + error.message);
    },
  });
}

// Get summary stats
export function usePayrollStats() {
  return useQuery({
    queryKey: ['payroll-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_obligations')
        .select('status');

      if (error) throw error;

      const obligations = data as { status: string }[];
      
      const stats = {
        total: obligations.length,
        pending: obligations.filter(d => d.status === 'pending').length,
        delayed: obligations.filter(d => d.status === 'delayed').length,
        completed: obligations.filter(d => d.status === 'completed').length,
      };

      return stats;
    },
  });
}
