import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb as supabase } from '@/integrations/local/client';
import { CashFlowTransaction, CreditCardInvoice } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { isFinanceDataUnavailableError, financeMutationToast, handleFinanceQueryError } from '@/lib/postgrest-errors';

type InvoicesPayload = { rows: CreditCardInvoice[]; schemaMissing: boolean };

// Lista faturas de um cartao (ordenadas por periodo desc)
export function useCreditCardInvoices(cardId: string | null | undefined) {
  const q = useQuery({
    queryKey: ['credit_card_invoices', cardId],
    queryFn: async (): Promise<InvoicesPayload> => {
      if (!cardId) return { rows: [], schemaMissing: false };
      const { data, error } = await supabase
        .from('credit_card_invoices')
        .select('*')
        .eq('credit_card_id', cardId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (error) {
        if (isFinanceDataUnavailableError(error)) {
          return { rows: [], schemaMissing: true };
        }
        throw error;
      }
      return { rows: (data || []) as CreditCardInvoice[], schemaMissing: false };
    },
    enabled: !!cardId,
  });

  return {
    ...q,
    data: q.data?.rows,
    schemaMissing: q.isSuccess ? Boolean(q.data?.schemaMissing) : false,
  };
}

// Lista transacoes ligadas a uma fatura
export function useInvoiceTransactions(invoiceId: string | null | undefined) {
  return useQuery({
    queryKey: ['credit_card_invoice_transactions', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [] as CashFlowTransaction[];
      const { data, error } = await supabase
        .from('cash_flow_transactions')
        .select(`
          *,
          account_categories(*),
          financial_accounts(*)
        `)
        .eq('credit_invoice_id', invoiceId)
        .order('date', { ascending: true });

      if (error) return handleFinanceQueryError(error, [] as CashFlowTransaction[]);

      return (data || []).map((row) => ({
        ...row,
        account: (row as { account_categories: unknown }).account_categories,
        financial_account: (row as { financial_accounts: unknown }).financial_accounts,
      })) as CashFlowTransaction[];
    },
    enabled: !!invoiceId,
  });
}

// Paga fatura: cria lancamento de saida na conta escolhida, vincula a fatura
export function usePayCreditCardInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      invoice,
      paymentAccountId,
      paymentDate,
      source,
    }: {
      invoice: CreditCardInvoice;
      paymentAccountId: string;
      paymentDate: string;
      source?: string;
    }) => {
      // 1) Cria lancamento de saida (despesa) no banco escolhido
      const description = `Pagamento Fatura ${String(invoice.period_month).padStart(2, '0')}/${invoice.period_year}`;

      const { data: payTx, error: payErr } = await supabase
        .from('cash_flow_transactions')
        .insert({
          date: paymentDate,
          due_date: paymentDate,
          paid_date: paymentDate,
          account_id: '8', // Grupo 8 = Cartoes de Credito (raiz)
          description,
          value: invoice.total_value,
          origin_destination: 'Fatura Cartao',
          type: 'expense',
          expense: invoice.total_value,
          income: 0,
          future_expense: 0,
          future_income: 0,
          financial_account_id: paymentAccountId,
          payment_method: 'debit',
          status: 'baixado',
          source: source || 'financeiro',
        })
        .select()
        .single();

      if (payErr) throw payErr;

      // 2) Atualiza a fatura (marca como paga + payment_transaction_id)
      const { error: invErr } = await supabase
        .from('credit_card_invoices')
        .update({
          status: 'paga',
          paid_date: paymentDate,
          payment_transaction_id: payTx.id,
        })
        .eq('id', invoice.id);

      if (invErr) throw invErr;

      // 3) Marca todos os lancamentos da fatura como baixados (paid_date = data da fatura)
      const { error: txErr } = await supabase
        .from('cash_flow_transactions')
        .update({
          status: 'baixado',
          paid_date: paymentDate,
        })
        .eq('credit_invoice_id', invoice.id)
        .neq('id', payTx.id);

      if (txErr) throw txErr;

      return payTx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_card_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['credit_card_invoice_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_summary'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['credit_card_usage'] });
      toast({ title: 'Fatura paga!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao pagar fatura', error);
    },
  });
}

// Reabre uma fatura paga (desfaz o pagamento)
export function useReopenCreditCardInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (invoice: CreditCardInvoice) => {
      if (invoice.payment_transaction_id) {
        await supabase
          .from('cash_flow_transactions')
          .delete()
          .eq('id', invoice.payment_transaction_id);
      }

      const { error } = await supabase
        .from('credit_card_invoices')
        .update({
          status: 'aberta',
          paid_date: null,
          payment_transaction_id: null,
        })
        .eq('id', invoice.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_card_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['credit_card_invoice_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash_flow_summary'] });
      toast({ title: 'Fatura reaberta!' });
    },
    onError: (error: unknown) => {
      financeMutationToast(toast, 'Erro ao reabrir fatura', error);
    },
  });
}
