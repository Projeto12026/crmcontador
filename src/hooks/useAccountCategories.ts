import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountCategory, AccountCategoryFormData, AccountGroupNumber, FinancialAccount } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

// Buscar todas as categorias organizadas em árvore
export function useAccountCategories() {
  return useQuery({
    queryKey: ['account_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_categories')
        .select(`
          *,
          financial_accounts!account_categories_id_fkey(*)
        `)
        .order('id');

      if (error) throw error;

      // Organizar em árvore hierárquica
      const categories = data as (AccountCategory & { financial_accounts: unknown[] })[];
      const categoryMap = new Map<string, AccountCategory>();
      const rootCategories: AccountCategory[] = [];

      // Primeiro passo: criar map de todas as categorias
      categories.forEach(cat => {
        const faList = cat.financial_accounts as FinancialAccount[] | undefined;
        categoryMap.set(cat.id, {
          ...cat,
          financial_account: faList?.[0] || null,
          subcategories: [],
        });
      });

      // Segundo passo: organizar hierarquia
      categories.forEach(cat => {
        const category = categoryMap.get(cat.id)!;
        if (cat.parent_id) {
          const parent = categoryMap.get(cat.parent_id);
          if (parent) {
            parent.subcategories = parent.subcategories || [];
            parent.subcategories.push(category);
          }
        } else {
          rootCategories.push(category);
        }
      });

      return rootCategories;
    },
  });
}

// Buscar categorias por grupo
export function useAccountCategoriesByGroup(groupNumber: AccountGroupNumber) {
  return useQuery({
    queryKey: ['account_categories', 'by_group', groupNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_categories')
        .select('*')
        .eq('group_number', groupNumber)
        .order('id');

      if (error) throw error;
      return data as AccountCategory[];
    },
  });
}

// Lista flat de todas as categorias (para selects)
export function useAccountCategoriesFlat() {
  return useQuery({
    queryKey: ['account_categories', 'flat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_categories')
        .select('*')
        .order('id');

      if (error) throw error;
      return data as AccountCategory[];
    },
  });
}

// Criar categoria
export function useCreateAccountCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: AccountCategoryFormData) => {
      // Primeiro criar a categoria
      const { data: category, error } = await supabase
        .from('account_categories')
        .insert({
          id: data.id,
          name: data.name,
          group_number: data.group_number,
          parent_id: data.parent_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Se solicitado, criar conta financeira vinculada
      if (data.create_financial_account && (data.group_number === 7 || data.group_number === 8)) {
        const { error: faError } = await supabase
          .from('financial_accounts')
          .insert({
            name: data.name,
            type: data.financial_account_type || (data.group_number === 8 ? 'credit' : 'bank'),
            initial_balance: data.financial_account_initial_balance || 0,
            current_balance: data.financial_account_initial_balance || 0,
            account_category_id: data.id,
          });

        if (faError) throw faError;
      }

      return category as AccountCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account_categories'] });
      queryClient.invalidateQueries({ queryKey: ['financial_accounts'] });
      toast({ title: 'Conta criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
    },
  });
}

// Atualizar categoria
export function useUpdateAccountCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AccountCategoryFormData> }) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.parent_id !== undefined) updateData.parent_id = data.parent_id || null;

      const { data: result, error } = await supabase
        .from('account_categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as AccountCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account_categories'] });
      toast({ title: 'Conta atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar conta', description: error.message, variant: 'destructive' });
    },
  });
}

// Excluir categoria
export function useDeleteAccountCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('account_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account_categories'] });
      toast({ title: 'Conta excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir conta', description: error.message, variant: 'destructive' });
    },
  });
}
