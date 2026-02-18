import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CoraEmpresa {
  id: string;
  client_id: string | null;
  client_name: string | null;
  cnpj: string;
  telefone: string | null;
  email: string | null;
  dia_vencimento: number;
  valor_mensal: number;
  forma_envio: string;
  observacoes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string } | null;
}

export interface CoraEmpresaFormData {
  client_id?: string | null;
  client_name?: string | null;
  cnpj: string;
  telefone?: string;
  email?: string;
  dia_vencimento?: number;
  valor_mensal?: number;
  forma_envio?: string;
  observacoes?: string;
  is_active?: boolean;
}

export interface CoraConfig {
  chave: string;
  valor: Record<string, unknown> | null;
  updated_at: string;
}

// ---- Empresas ----

export function useCoraEmpresas() {
  return useQuery({
    queryKey: ['cora_empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cora_empresas')
        .select('*, clients(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((item: any) => ({
        ...item,
        client: item.clients,
      })) as CoraEmpresa[];
    },
  });
}

export function useCreateCoraEmpresa() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: CoraEmpresaFormData) => {
      const { data: result, error } = await supabase
        .from('cora_empresas')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cora_empresas'] });
      toast({ title: 'Empresa Cora criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar empresa', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateCoraEmpresa() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CoraEmpresaFormData> }) => {
      const updateData: Record<string, unknown> = { ...data };
      delete updateData.client;
      const { data: result, error } = await supabase
        .from('cora_empresas')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cora_empresas'] });
      toast({ title: 'Empresa atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar empresa', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteCoraEmpresa() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cora_empresas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cora_empresas'] });
      toast({ title: 'Empresa excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir empresa', description: error.message, variant: 'destructive' });
    },
  });
}

// ---- Config ----

export function useCoraConfig() {
  return useQuery({
    queryKey: ['cora_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cora_config')
        .select('*');
      if (error) throw error;
      return data as CoraConfig[];
    },
  });
}

export function useUpsertCoraConfig() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('cora_config')
        .upsert([{ chave, valor, updated_at: new Date().toISOString() }] as any, { onConflict: 'chave' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cora_config'] });
      toast({ title: 'Configuração salva!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configuração', description: error.message, variant: 'destructive' });
    },
  });
}

// ---- Boletos (cache) ----

export interface CoraBoleto {
  id: string;
  cora_invoice_id: string;
  empresa_id: string | null;
  cnpj: string;
  status: string;
  total_amount_cents: number | null;
  due_date: string | null;
  paid_at: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  raw_json: unknown;
  created_at: string;
  synced_at: string;
}

export function useCoraBoletos(competenciaAno?: number, competenciaMes?: number) {
  return useQuery({
    queryKey: ['cora_boletos', competenciaAno, competenciaMes],
    queryFn: async () => {
      let query = supabase
        .from('cora_boletos')
        .select('*')
        .order('due_date', { ascending: true });
      if (competenciaAno) query = query.eq('competencia_ano', competenciaAno);
      if (competenciaMes) query = query.eq('competencia_mes', competenciaMes);
      const { data, error } = await query;
      if (error) throw error;
      return data as CoraBoleto[];
    },
  });
}

// ---- Sync Empresas from CRM ----

export function useSyncEmpresasFromCRM() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      // 1. Fetch active clients with active contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('client_id, monthly_value, billing_day, clients(id, name, document, phone, email)')
        .eq('status', 'active')
        .not('client_id', 'is', null);
      if (contractsError) throw contractsError;

      // 2. Fetch existing cora_empresas CNPJs
      const { data: existing, error: existingError } = await supabase
        .from('cora_empresas')
        .select('cnpj');
      if (existingError) throw existingError;

      const existingCnpjs = new Set((existing || []).map(e => e.cnpj.replace(/\D/g, '')));

      // 3. Build new entries (skip duplicates by CNPJ)
      const newEntries: CoraEmpresaFormData[] = [];
      const seen = new Set<string>();

      for (const contract of contractsData || []) {
        const client = contract.clients as any;
        if (!client?.document) continue;
        const cnpjClean = client.document.replace(/\D/g, '');
        if (cnpjClean.length !== 14) continue; // skip CPFs
        if (existingCnpjs.has(cnpjClean) || seen.has(cnpjClean)) continue;
        seen.add(cnpjClean);

        newEntries.push({
          client_id: client.id,
          client_name: client.name,
          cnpj: cnpjClean,
          telefone: client.phone || '',
          email: client.email || '',
          dia_vencimento: contract.billing_day || 15,
          valor_mensal: contract.monthly_value || 0,
          forma_envio: 'WHATSAPP',
          is_active: true,
        });
      }

      if (newEntries.length === 0) {
        return { inserted: 0, total: existingCnpjs.size };
      }

      // 4. Insert in batches of 50
      let inserted = 0;
      for (let i = 0; i < newEntries.length; i += 50) {
        const batch = newEntries.slice(i, i + 50);
        const { error } = await supabase.from('cora_empresas').insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }

      return { inserted, total: existingCnpjs.size + inserted };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['cora_empresas'] });
      if (result.inserted === 0) {
        toast({ title: 'Nenhuma nova empresa para sincronizar', description: `${result.total} empresas já cadastradas.` });
      } else {
        toast({ title: `${result.inserted} empresas sincronizadas!`, description: `Total: ${result.total} empresas no Cora.` });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao sincronizar empresas', description: error.message, variant: 'destructive' });
    },
  });
}

// ---- Envios (logs) ----

export interface CoraEnvio {
  id: string;
  empresa_id: string | null;
  boleto_id: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  canal: string | null;
  sucesso: boolean | null;
  detalhe: string | null;
  created_at: string;
}

export function useCoraEnvios(competenciaAno?: number, competenciaMes?: number) {
  return useQuery({
    queryKey: ['cora_envios', competenciaAno, competenciaMes],
    queryFn: async () => {
      let query = supabase
        .from('cora_envios')
        .select('*')
        .order('created_at', { ascending: false });
      if (competenciaAno) query = query.eq('competencia_ano', competenciaAno);
      if (competenciaMes) query = query.eq('competencia_mes', competenciaMes);
      const { data, error } = await query;
      if (error) throw error;
      return data as CoraEnvio[];
    },
  });
}

// ===================== MESSAGE TEMPLATES =====================

export interface CoraMessageTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  message_body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCoraMessageTemplates() {
  return useQuery({
    queryKey: ['cora-message-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cora_message_templates' as any)
        .select('*')
        .order('template_key');
      if (error) throw error;
      return data as unknown as CoraMessageTemplate[];
    },
  });
}

export function useUpdateCoraMessageTemplate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, message_body, is_active }: { id: string; message_body: string; is_active?: boolean }) => {
      const updates: any = { message_body };
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase
        .from('cora_message_templates' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cora-message-templates'] });
      toast({ title: 'Template atualizado com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar template', description: err.message, variant: 'destructive' });
    },
  });
}
