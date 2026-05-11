import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb as supabase } from '@/integrations/local/client';
import { CreditCard, CreditCardFormData } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { isFinanceDataUnavailableError, financeMutationToast, handleFinanceQueryError } from '@/lib/postgrest-errors';

type CreditCardsPayload = { rows: CreditCard[]; schemaMissing: boolean };

// Busca todos os cartoes de credito (com sua financial_account)
export function useCreditCards() {
  const q = useQuery({
    queryKey: ['credit_cards'],
    queryFn: async (): Promise<CreditCardsPayload> => {
      const { data, error } = await supabase
        .from('credit_cards')
        .select(
          `
          *,
          financial_accounts!credit_cards_financial_account_id_fkey(
            *,
            account_categories(*)
          )
        `,
        )
        .order('created_at', { ascending: true });

      if (error) {
        if (isFinanceDataUnavailableError(error)) {
          return { rows: [], schemaMissing: true };
        }
        throw error;
      }

      const rows = (data || []).map((row) => {
        const raw = row as {
          financial_accounts: Record<string, unknown> & { account_categories?: unknown };
        };
        const fa = raw.financial_accounts;
        const account_category = fa?.account_categories;
        const { account_categories: _omit, ...faRest } = (fa || {}) as Record<string, unknown>;
        const { financial_accounts: _strip, ...cardRest } = row as Record<string, unknown>;
        return {
          ...cardRest,
          financial_account: fa
            ? ({ ...faRest, account_category: account_category ?? null } as CreditCard['financial_account'])
            : null,
        };
      }) as CreditCard[];

      return { rows, schemaMissing: false };
    },
  });

  return {
    ...q,
    data: q.data?.rows,
    schemaMissing: q.isSuccess ? Boolean(q.data?.schemaMissing) : false,
  };
}

// Cria cartao: vincula a uma financial_account tipo credit já existente (cadastrada em Contas financeiras)
export function useCreateCreditCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreditCardFormData) => {
      if (!data.financial_account_id) {
        throw new Error('Selecione uma conta financeira do tipo cartão de crédito.');
      }

      const { data: fa, error: faErr } = await supabase
        .from('financial_accounts')
        .select('id, type')
        .eq('id', data.financial_account_id)
        .single();

      if (faErr) throw faErr;
      if (fa.type !== 'credit') {
        throw new Error('A conta selecionada precisa ser do tipo cartão de crédito (Contas financeiras).');
      }

      const { data: existingCard } = await supabase
        .from('credit_cards')
        .select('id')
        .eq('financial_account_id', fa.id)
        .maybeSingle();

      if (existingCard) {
        throw new Error('Esta conta financeira já possui um cartão cadastrado.');
      }

      const { error: nameErr } = await supabase
        .from('financial_accounts')
        .update({ name: data.name.trim() })
        .eq('id', fa.id);
      if (nameErr) throw nameErr;

      const { data: card, error: cardErr } = await supabase
        .from('credit_cards')
        .insert({
          financial_account_id: fa.id,
          brand: data.brand ?? null,
          credit_limit: data.credit_limit,
          closing_day: data.closing_day,
          due_day: data.due_day,
          color: data.color ?? null,
          icon: data.icon ?? null,
        })
        .select()
        .single();

      if (cardErr) throw cardErr;

      return card as CreditCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      queryClient.invalidateQueries({ queryKey: ['credit_card_usage'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account_categories'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      toast({ title: 'Cartao criado!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao criar cartao', error);
    },
  });
}

export function useUpdateCreditCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      previousFinancialAccountId,
      data,
    }: {
      id: string;
      previousFinancialAccountId: string;
      data: Partial<CreditCardFormData> & { financial_account_id: string };
    }) => {
      const { financial_account_id, name, ...rest } = data;
      const updates: Record<string, unknown> = {};
      if (rest.brand !== undefined) updates.brand = rest.brand;
      if (rest.credit_limit !== undefined) updates.credit_limit = rest.credit_limit;
      if (rest.closing_day !== undefined) updates.closing_day = rest.closing_day;
      if (rest.due_day !== undefined) updates.due_day = rest.due_day;
      if (rest.color !== undefined) updates.color = rest.color;
      if (rest.icon !== undefined) updates.icon = rest.icon;

      if (financial_account_id !== previousFinancialAccountId) {
        const { data: fa, error: faErr } = await supabase
          .from('financial_accounts')
          .select('id, type')
          .eq('id', financial_account_id)
          .single();
        if (faErr) throw faErr;
        if ((fa as { type: string }).type !== 'credit') {
          throw new Error('A nova conta precisa ser do tipo cartão de crédito.');
        }
        const { data: other } = await supabase
          .from('credit_cards')
          .select('id')
          .eq('financial_account_id', financial_account_id)
          .neq('id', id)
          .maybeSingle();
        if (other) {
          throw new Error('Esta conta financeira já está vinculada a outro cartão.');
        }
        updates.financial_account_id = financial_account_id;
      }

      let card: CreditCard;
      if (Object.keys(updates).length > 0) {
        const { data: row, error } = await supabase
          .from('credit_cards')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        card = row as CreditCard;
      } else {
        const { data: row, error } = await supabase.from('credit_cards').select().eq('id', id).single();
        if (error) throw error;
        card = row as CreditCard;
      }

      const targetFaId = financial_account_id;
      if (name?.trim()) {
        const { error: accErr } = await supabase
          .from('financial_accounts')
          .update({ name: name.trim() })
          .eq('id', targetFaId);
        if (accErr) throw accErr;
      }

      return card as CreditCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      queryClient.invalidateQueries({ queryKey: ['credit_card_usage'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account_categories'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      toast({ title: 'Cartao atualizado!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao atualizar cartao', error);
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
      queryClient.invalidateQueries({ queryKey: ['credit_card_usage'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['credit_card_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['account_categories'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      toast({ title: 'Cartao excluido!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao excluir cartao', error);
    },
  });
}

/**
 * Limite usado: transações com credit_card_id OU despesa com financial_account_id da conta financeira do cartão.
 */
export function useCreditCardUsage(
  cardId: string | null | undefined,
  linkedFinancialAccountId?: string | null,
) {
  return useQuery({
    queryKey: ['credit_card_usage', cardId, linkedFinancialAccountId ?? ''],
    queryFn: async () => {
      if (!cardId) return { used: 0, count: 0 };

      type Row = { id: string; value: number | null; status: string | null };

      const mergeRows = (rows: Row[]): Row[] => {
        const byId = new Map<string, Row>();
        for (const r of rows) {
          if (!byId.has(r.id)) byId.set(r.id, r);
        }
        return Array.from(byId.values());
      };

      const { data: byCard, error: errCard } = await supabase
        .from('cash_flow_transactions')
        .select('id, value, status')
        .eq('credit_card_id', cardId);

      if (errCard) return handleFinanceQueryError(errCard, { used: 0, count: 0 });

      let byFa: Row[] = [];
      if (linkedFinancialAccountId) {
        const { data, error: errFa } = await supabase
          .from('cash_flow_transactions')
          .select('id, value, status')
          .eq('financial_account_id', linkedFinancialAccountId)
          .eq('type', 'expense');
        if (errFa) return handleFinanceQueryError(errFa, { used: 0, count: 0 });
        byFa = (data || []) as Row[];
      }

      const merged = mergeRows([...((byCard || []) as Row[]), ...byFa]);
      const used = merged
        .filter((t) => t.status !== 'baixado')
        .reduce((sum, t) => sum + Number(t.value || 0), 0);
      return { used, count: merged.length };
    },
    enabled: !!cardId,
  });
}
