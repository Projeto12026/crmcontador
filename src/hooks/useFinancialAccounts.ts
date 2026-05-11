import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb as supabase } from '@/integrations/local/client';
import { FinancialAccount, FinancialAccountFormData, FinancialAccountType } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { handleFinanceQueryError, financeMutationToast } from '@/lib/postgrest-errors';

// Buscar todas as contas financeiras
export function useFinancialAccounts() {
  return useQuery({
    queryKey: ['financial_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select(`
          *,
          account_categories(*)
        `)
        .order('name');

      if (error) return handleFinanceQueryError(error, [] as FinancialAccount[]);

      return (data || []).map(item => ({
        ...item,
        account_category: item.account_categories,
      })) as FinancialAccount[];
    },
  });
}

// Buscar contas por tipo
export function useFinancialAccountsByType(type: FinancialAccountType) {
  return useQuery({
    queryKey: ['financial_accounts', 'by_type', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('*')
        .eq('type', type)
        .order('name');

      if (error) return handleFinanceQueryError(error, [] as FinancialAccount[]);
      return (data || []) as FinancialAccount[];
    },
  });
}

// Criar conta financeira
export function useCreateFinancialAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: FinancialAccountFormData) => {
      const { data: result, error } = await supabase
        .from('financial_accounts')
        .insert({
          name: data.name,
          type: data.type,
          initial_balance: data.initial_balance,
          current_balance: data.initial_balance,
          account_category_id: data.account_category_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result as FinancialAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Conta financeira criada!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao criar conta financeira', error);
    },
  });
}

// Atualizar conta financeira
export function useUpdateFinancialAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FinancialAccountFormData> }) => {
      const { data: result, error } = await supabase
        .from('financial_accounts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as FinancialAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Conta atualizada!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao atualizar conta', error);
    },
  });
}

// Excluir conta financeira
export function useDeleteFinancialAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Conta excluída!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao excluir conta', error);
    },
  });
}

// Recalcular saldo de uma conta financeira
export function useRecalculateBalance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (accountId: string) => {
      // Buscar conta para pegar saldo inicial
      const { data: account, error: accError } = await supabase
        .from('financial_accounts')
        .select('initial_balance')
        .eq('id', accountId)
        .single();

      if (accError) throw accError;

      // Buscar todas as transações da conta
      const { data: transactions, error: txError } = await supabase
        .from('cash_flow_transactions')
        .select('income, expense, future_income, future_expense')
        .eq('financial_account_id', accountId);

      if (txError) throw txError;

      // Calcular saldo
      let balance = Number(account.initial_balance) || 0;
      transactions?.forEach(tx => {
        balance += Number(tx.income || 0) + Number(tx.future_income || 0);
        balance -= Number(tx.expense || 0) + Number(tx.future_expense || 0);
      });

      // Atualizar saldo
      const { error: updateError } = await supabase
        .from('financial_accounts')
        .update({ current_balance: balance })
        .eq('id', accountId);

      if (updateError) throw updateError;

      return balance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao recalcular saldo', error);
    },
  });
}
