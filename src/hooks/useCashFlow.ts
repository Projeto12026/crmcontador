import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CashFlowTransaction, CashFlowTransactionFormData, CashFlowSummary, AccountGroupNumber, TransactionType, EXCLUDED_ACCOUNT_GROUPS } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, parseISO } from 'date-fns';

// Buscar lançamentos
export function useCashFlowTransactions(filters?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  type?: TransactionType;
  financialAccountId?: string;
  source?: string;
}) {
  return useQuery({
    queryKey: ['cash_flow_transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('cash_flow_transactions')
        .select(`
          *,
          account_categories(*),
          financial_accounts(*),
          clients(id, name)
        `)
        .order('date', { ascending: false });

      if (filters?.source) {
        query = query.eq('source', filters.source);
      }
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.financialAccountId) {
        query = query.eq('financial_account_id', filters.financialAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map(item => ({
        ...item,
        account: item.account_categories,
        financial_account: item.financial_accounts,
        client: item.clients,
      })) as CashFlowTransaction[];
    },
  });
}

// Resumo do fluxo de caixa por período
export function useCashFlowSummary(startDate: string, endDate: string, financialAccountId?: string, source?: string) {
  return useQuery({
    queryKey: ['cash_flow_summary', startDate, endDate, financialAccountId, source],
    queryFn: async () => {
      let query = supabase
        .from('cash_flow_transactions')
        .select(`
          income, expense, future_income, future_expense,
          account_categories!inner(group_number)
        `)
        .gte('date', startDate)
        .lte('date', endDate);

      if (source) {
        query = query.eq('source', source);
      }
      if (financialAccountId) {
        query = query.eq('financial_account_id', financialAccountId);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      // Nescon usa todos os seus grupos; Financeiro exclui grupos > 6 e administrativos (100, 200)
      const filtered = transactions?.filter(t => {
        const group = (t.account_categories as { group_number: number })?.group_number;
        if (!group) return false;
        if (source === 'nescon') return true;
        if (group > 6 || EXCLUDED_ACCOUNT_GROUPS.has(group)) return false;
        return true;
      }) || [];

      const summary: CashFlowSummary = {
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        projectedIncome: 0,
        projectedExpense: 0,
        executedIncome: 0,
        executedExpense: 0,
        executedBalance: 0,
        transactionCount: filtered.length,
      };

      filtered.forEach(t => {
        const income = Number(t.income || 0);
        const expense = Number(t.expense || 0);
        const futureIncome = Number(t.future_income || 0);
        const futureExpense = Number(t.future_expense || 0);

        summary.executedIncome += income;
        summary.executedExpense += expense;
        summary.projectedIncome += futureIncome;
        summary.projectedExpense += futureExpense;
        summary.totalIncome += income + futureIncome;
        summary.totalExpense += expense + futureExpense;
      });

      summary.balance = summary.totalIncome - summary.totalExpense;
      summary.executedBalance = summary.executedIncome - summary.executedExpense;

      return summary;
    },
  });
}

// Fluxo por grupo (estatísticas)
export function useCashFlowByGroup() {
  return useQuery({
    queryKey: ['cash_flow_by_group'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_flow_transactions')
        .select(`
          income, expense, future_income, future_expense,
          account_categories!inner(group_number, name)
        `);

      if (error) throw error;

      const groupStats: Record<number, { total: number; name: string }> = {};

      data?.forEach(t => {
        const group = (t.account_categories as { group_number: number; name: string })?.group_number;
        if (!group || group > 6) return; // Excluir grupos 7 e 8

        if (!groupStats[group]) {
          groupStats[group] = { total: 0, name: '' };
        }

        const income = Number(t.income || 0) + Number(t.future_income || 0);
        const expense = Number(t.expense || 0) + Number(t.future_expense || 0);
        groupStats[group].total += income - expense;
      });

      return groupStats;
    },
  });
}

// Criar lançamento (com suporte a parcelamento)
export function useCreateCashFlowTransaction(source: string = 'financeiro') {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CashFlowTransactionFormData) => {
      const installmentCount = data.is_installment ? (data.installment_count || 2) : 1;
      const valuePerInstallment = data.value;
      const baseDate = parseISO(data.date);
      
      const transactionsToInsert = [];

      for (let i = 0; i < installmentCount; i++) {
        const installmentDate = addMonths(baseDate, i);
        const description = installmentCount > 1 
          ? `${data.description} (${i + 1}/${installmentCount})`
          : data.description;

        const insertData: Record<string, unknown> = {
          date: format(installmentDate, 'yyyy-MM-dd'),
          account_id: data.account_id,
          description,
          value: valuePerInstallment,
          origin_destination: data.origin_destination,
          type: data.type,
          financial_account_id: data.financial_account_id || null,
          client_id: data.client_id || null,
          contract_id: data.contract_id || null,
          notes: data.notes || null,
          paid_by_company: data.paid_by_company || false,
          source,
        };

        if (data.is_future || i > 0) {
          if (data.type === 'income') {
            insertData.future_income = valuePerInstallment;
            insertData.future_expense = 0;
            insertData.income = 0;
            insertData.expense = 0;
          } else {
            insertData.future_expense = valuePerInstallment;
            insertData.future_income = 0;
            insertData.income = 0;
            insertData.expense = 0;
          }
        } else {
          if (data.type === 'income') {
            insertData.income = valuePerInstallment;
            insertData.expense = 0;
            insertData.future_income = 0;
            insertData.future_expense = 0;
          } else {
            insertData.expense = valuePerInstallment;
            insertData.income = 0;
            insertData.future_income = 0;
            insertData.future_expense = 0;
          }
        }

        transactionsToInsert.push({
          date: insertData.date as string,
          account_id: insertData.account_id as string,
          description: insertData.description as string,
          value: insertData.value as number,
          origin_destination: insertData.origin_destination as string,
          type: insertData.type as TransactionType,
          financial_account_id: insertData.financial_account_id as string | null,
          client_id: insertData.client_id as string | null,
          contract_id: insertData.contract_id as string | null,
          notes: insertData.notes as string | null,
          paid_by_company: insertData.paid_by_company as boolean,
          income: insertData.income as number,
          expense: insertData.expense as number,
          future_income: insertData.future_income as number,
          future_expense: insertData.future_expense as number,
          source: insertData.source as string,
        });
      }

      const { data: result, error } = await supabase
        .from('cash_flow_transactions')
        .insert(transactionsToInsert)
        .select();

      if (error) throw error;
      return result as CashFlowTransaction[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_summary'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      const count = data.length;
      toast({ 
        title: count > 1 
          ? `${count} lançamentos criados!` 
          : 'Lançamento criado!' 
      });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar lançamento', description: error.message, variant: 'destructive' });
    },
  });
}

// Liquidar valor futuro (projetado → realizado)
export function useSettleTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Buscar transação atual
      const { data: tx, error: fetchError } = await supabase
        .from('cash_flow_transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const updateData: Record<string, unknown> = {};
      const futureIncome = Number(tx.future_income || 0);
      const futureExpense = Number(tx.future_expense || 0);

      if (futureIncome > 0) {
        updateData.income = Number(tx.income || 0) + futureIncome;
        updateData.future_income = 0;
        updateData.value = updateData.income;
      } else if (futureExpense > 0) {
        updateData.expense = Number(tx.expense || 0) + futureExpense;
        updateData.future_expense = 0;
        updateData.value = updateData.expense;
      } else {
        throw new Error('Não há valor futuro para liquidar');
      }

      const { data: result, error } = await supabase
        .from('cash_flow_transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as CashFlowTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_summary'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Valor liquidado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao liquidar', description: error.message, variant: 'destructive' });
    },
  });
}

// Excluir lançamento
export function useDeleteCashFlowTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cash_flow_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_summary'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Lançamento excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });
}

// Atualizar lançamento
export function useUpdateCashFlowTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CashFlowTransactionFormData }) => {
      const updateData: Record<string, unknown> = {
        date: data.date,
        account_id: data.account_id,
        description: data.description,
        value: data.value,
        origin_destination: data.origin_destination,
        type: data.type,
        financial_account_id: data.financial_account_id || null,
        client_id: data.client_id || null,
        notes: data.notes || null,
      };

      if (data.is_future) {
        if (data.type === 'income') {
          updateData.future_income = data.value;
          updateData.future_expense = 0;
          updateData.income = 0;
          updateData.expense = 0;
        } else {
          updateData.future_expense = data.value;
          updateData.future_income = 0;
          updateData.income = 0;
          updateData.expense = 0;
        }
      } else {
        if (data.type === 'income') {
          updateData.income = data.value;
          updateData.expense = 0;
          updateData.future_income = 0;
          updateData.future_expense = 0;
        } else {
          updateData.expense = data.value;
          updateData.income = 0;
          updateData.future_income = 0;
          updateData.future_expense = 0;
        }
      }

      const { data: result, error } = await supabase
        .from('cash_flow_transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as CashFlowTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_summary'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Lançamento atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });
}
