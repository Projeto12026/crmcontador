import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WhatsAppConfig {
  id: string;
  token: string | null;
  api_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  nome: string;
  tipo: string | null;
  template_antes_vencimento: string | null;
  template_pos_vencimento: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppConfig() {
  return useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as WhatsAppConfig | null;
    },
  });
}

export function useSaveWhatsAppConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<WhatsAppConfig> & { id?: string }) => {
      if (config.id) {
        const { data, error } = await supabase
          .from('whatsapp_config')
          .update({
            token: config.token,
            api_url: config.api_url,
            ativo: config.ativo,
          })
          .eq('id', config.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('whatsapp_config')
          .insert([{
            token: config.token,
            api_url: config.api_url,
            ativo: config.ativo ?? false,
          }])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      toast({
        title: 'Sucesso',
        description: 'Configuração do WhatsApp salva!',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configuração',
        variant: 'destructive',
      });
    },
  });
}

export function useTestWhatsAppConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ token, apiUrl }: { token: string; apiUrl: string }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'test_connection',
          token,
          apiUrl,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Conexão OK',
          description: 'WhatsApp conectado com sucesso!',
        });
      } else {
        toast({
          title: 'Falha na conexão',
          description: data.error || 'Não foi possível conectar',
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao testar conexão',
        variant: 'destructive',
      });
    },
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MessageTemplate[];
    },
  });
}

export function useMessageTemplate(id?: string) {
  return useQuery({
    queryKey: ['message-template', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as MessageTemplate;
    },
    enabled: !!id,
  });
}

export function useSaveMessageTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: Partial<MessageTemplate> & { id?: string }) => {
      if (template.id) {
        const { data, error } = await supabase
          .from('message_templates')
          .update({
            nome: template.nome,
            tipo: template.tipo,
            template_antes_vencimento: template.template_antes_vencimento,
            template_pos_vencimento: template.template_pos_vencimento,
            ativo: template.ativo,
          })
          .eq('id', template.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('message_templates')
          .insert([{
            nome: template.nome || 'Novo Template',
            tipo: template.tipo,
            template_antes_vencimento: template.template_antes_vencimento,
            template_pos_vencimento: template.template_pos_vencimento,
            ativo: template.ativo ?? true,
          }])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: 'Sucesso',
        description: 'Template salvo com sucesso!',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar template',
        variant: 'destructive',
      });
    },
  });
}

export function useProcessBoleto() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      empresa: { nome: string; cnpj: string; telefone: string; apelido?: string };
      competencia: string;
      invoiceId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('process-boleto', {
        body: params,
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Boleto enviado!',
        description: `Enviado para ${data.details.empresa}: R$ ${data.details.valor}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar boleto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
