import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats } from '@/types/crm';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

      const [
        clientsResult,
        contractsResult,
        tasksResult,
        leadsResult,
        revenueResult,
        overdueResult,
        processesResult,
        onboardingsResult,
      ] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('contracts').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('tasks').select('id', { count: 'exact' }).in('status', ['pending', 'in_progress']),
        supabase.from('leads').select('id', { count: 'exact' }).not('status', 'in', '("won","lost")'),
        supabase.from('financial_transactions')
          .select('amount')
          .eq('type', 'income')
          .eq('status', 'paid')
          .gte('paid_date', startOfMonth)
          .lte('paid_date', endOfMonth),
        supabase.from('financial_transactions')
          .select('id', { count: 'exact' })
          .eq('status', 'pending')
          .lt('due_date', today),
        supabase.from('processes').select('id', { count: 'exact' }).eq('status', 'in_progress'),
        supabase.from('client_onboarding').select('id', { count: 'exact' }).eq('status', 'in_progress'),
      ]);

      const monthlyRevenue = (revenueResult.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);

      return {
        totalClients: clientsResult.count || 0,
        activeContracts: contractsResult.count || 0,
        pendingTasks: tasksResult.count || 0,
        openLeads: leadsResult.count || 0,
        monthlyRevenue,
        overdueTransactions: overdueResult.count || 0,
        processesInProgress: processesResult.count || 0,
        onboardingsInProgress: onboardingsResult.count || 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
