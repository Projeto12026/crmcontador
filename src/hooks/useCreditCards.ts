import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb as supabase } from '@/integrations/local/client';
import { CreditCard, CreditCardFormData } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

// Busca todos os cartoes de credito (com sua financial_account)
export function useCreditCards() {
  return useQuery({
    queryKey: ['credit_cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_cards')
        .select(`*, financial_accounts!credit_cards_financial_account_id_fkey(*)`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => ({
        ...row,
        financial_account: (row as { financial_accounts: unknown }).financial_accounts,
      })) as CreditCard[];
    },
  });
}

// Cria cartao: insere financial_accounts (type=credit) e credit_cards atomico via dois passos
export function useCreateCreditCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreditCardFormData) => {
      const { data: acc, error: accErr } = await supabase
        .from('financial_accounts')
        .insert({
          name: data.name,
          type: 'credit',
          initial_balance: data.initial_balance ?? 0,
          current_balance: data.initial_balance ?? 0,
        })
        .select()
        .single();

      if (accErr) throw accErr;

      const { data: card, error: cardErr } = await supabase
        .from('credit_cards')
        .insert({
          financial_account_id: acc.id,
          brand: data.brand ?? null,
          credit_limit: data.credit_limit,
          closing_day: data.closing_day,
          due_day: data.due_day,
          color: data.color ?? null,
          icon: data.icon ?? null,
        })
        .select()
        .single();

      if (cardErr) {
        // Rollback manual da conta criada (compensacao)
        await supabase.from('financial_accounts').delete().eq('id', acc.id);
        throw cardErr;
      }

      return card as CreditCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Cartao criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar cartao', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateCreditCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreditCardFormData> & { financial_account_id?: string };
    }) => {
      const { financial_account_id, name, initial_balance, ...rest } = data;
      const updates: Record<string, unknown> = {};
      if (rest.brand !== undefined) updates.brand = rest.brand;
      if (rest.credit_limit !== undefined) updates.credit_limit = rest.credit_limit;
      if (rest.closing_day !== undefined) updates.closing_day = rest.closing_day;
      if (rest.due_day !== undefined) updates.due_day = rest.due_day;
      if (rest.color !== undefined) updates.color = rest.color;
      if (rest.icon !== undefined) updates.icon = rest.icon;

      const { data: card, error } = await supabase
        .from('credit_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if ((name || initial_balance !== undefined) && financial_account_id) {
        const accUpdate: Record<string, unknown> = {};
        if (name) accUpdate.name = name;
        if (initial_balance !== undefined) accUpdate.initial_balance = initial_balance;
        await supabase
          .from('financial_accounts')
          .update(accUpdate)
          .eq('id', financial_account_id);
      }

      return card as CreditCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Cartao atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar cartao', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteCreditCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (financialAccountId: string) => {
      // ON DELETE CASCADE no credit_cards remove o cartao + faturas
      const { error } = await supabase
        .from('financial_accounts')
        .delete()
        .eq('id', financialAccountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['credit_card_invoices'] });
      toast({ title: 'Cartao excluido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir cartao', description: error.message, variant: 'destructive' });
    },
  });
}

// Calcula limite usado por cartao (soma de value das transacoes ligadas com status != baixado)
export function useCreditCardUsage(cardId: string | null | undefined) {
  return useQuery({
    queryKey: ['credit_card_usage', cardId],
    queryFn: async () => {
      if (!cardId) return { used: 0, count: 0 };
      const { data, error } = await supabase
        .from('cash_flow_transactions')
        .select('value, status')
        .eq('credit_card_id', cardId);
      if (error) throw error;

      const used = (data || [])
        .filter((t) => t.status !== 'baixado')
        .reduce((sum, t) => sum + Number(t.value || 0), 0);

      return { used, count: (data || []).length };
    },
    enabled: !!cardId,
  });
}
