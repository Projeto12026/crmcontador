import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Empresa, EmpresaStats, EmpresaStatus } from '@/types/empresa';
import { EmpresaFormData } from '@/lib/validators';
import { useToast } from '@/hooks/use-toast';

export function useEmpresas(statusFilter?: EmpresaStatus | 'ALL') {
  return useQuery({
    queryKey: ['empresas', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('empresas')
        .select('*')
        .order('nome', { ascending: true });
      
      if (statusFilter && statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Empresa[];
    },
  });
}

export function useEmpresa(id: string) {
  return useQuery({
    queryKey: ['empresa', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Empresa;
    },
    enabled: !!id,
  });
}

export function useEmpresaStats() {
  return useQuery({
    queryKey: ['empresas-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('status');
      
      if (error) throw error;
      
      const stats: EmpresaStats = {
        total: data.length,
        active: data.filter(e => e.status === 'ACTIVE').length,
        inactive: data.filter(e => e.status === 'INACTIVE').length,
        pending: data.filter(e => e.status === 'PENDING').length,
        overdue: data.filter(e => e.status === 'OVERDUE').length,
        unknown: data.filter(e => e.status === 'UNKNOWN').length,
        open: data.filter(e => e.status === 'OPEN').length,
        late: data.filter(e => e.status === 'LATE').length,
        paid: data.filter(e => e.status === 'PAID').length,
        cancelled: data.filter(e => e.status === 'CANCELLED').length,
        erro_consulta: data.filter(e => e.status === 'ERRO_CONSULTA').length,
      };
      
      return stats;
    },
  });
}

export function useCreateEmpresa() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (empresa: EmpresaFormData) => {
      const { data, error } = await supabase
        .from('empresas')
        .insert([{
          nome: empresa.nome,
          apelido: empresa.apelido || null,
          cnpj: empresa.cnpj,
          dia_vencimento: empresa.dia_vencimento || null,
          forma_envio: empresa.forma_envio,
          telefone: empresa.telefone || null,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data as Empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresas-stats'] });
      toast({
        title: 'Sucesso',
        description: 'Empresa criada com sucesso!',
      });
    },
    onError: (error: Error) => {
      const isDuplicate = error.message.includes('unique') || error.message.includes('duplicate');
      toast({
        title: 'Erro',
        description: isDuplicate ? 'CNPJ já cadastrado' : 'Erro ao criar empresa',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateEmpresa() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...empresa }: EmpresaFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('empresas')
        .update({
          nome: empresa.nome,
          apelido: empresa.apelido || null,
          cnpj: empresa.cnpj,
          dia_vencimento: empresa.dia_vencimento || null,
          forma_envio: empresa.forma_envio,
          telefone: empresa.telefone || null,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresas-stats'] });
      toast({
        title: 'Sucesso',
        description: 'Empresa atualizada com sucesso!',
      });
    },
    onError: (error: Error) => {
      const isDuplicate = error.message.includes('unique') || error.message.includes('duplicate');
      toast({
        title: 'Erro',
        description: isDuplicate ? 'CNPJ já cadastrado' : 'Erro ao atualizar empresa',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteEmpresa() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresas-stats'] });
      toast({
        title: 'Sucesso',
        description: 'Empresa excluída com sucesso!',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir empresa',
        variant: 'destructive',
      });
    },
  });
}
