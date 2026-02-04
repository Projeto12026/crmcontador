import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSyncStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ empresaId, cnpj, competencia }: { 
      empresaId: string; 
      cnpj: string; 
      competencia: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('sync-status', {
        body: { empresaId, cnpj, competencia },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresas-stats'] });
      toast({
        title: 'Status atualizado',
        description: `Status: ${data.status} | Valor: R$ ${data.amount || '0,00'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao sincronizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSyncAllStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ competencia }: { competencia: string }) => {
      const { data, error } = await supabase.functions.invoke('sync-status', {
        body: { action: 'sync_all', competencia },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresas-stats'] });
      toast({
        title: 'Sincronização concluída',
        description: `${data.processed} empresas processadas, ${data.updated} atualizadas`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na sincronização',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
