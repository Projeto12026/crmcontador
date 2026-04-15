import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Client, ClientFormData } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import type { ParsedImportRow } from '@/lib/client-import';

function onlyDigitsDoc(s: string | undefined): string {
  return String(s ?? '').replace(/\D/g, '');
}

function deleteClientFriendlyMessage(error: unknown): string {
  const o = error as Record<string, unknown> | null;
  const msg = String(o?.message ?? o?.error_description ?? o?.details ?? '');
  const code = String(o?.code ?? '');
  const blob = error && typeof error === 'object' ? JSON.stringify(error) : '';
  if (
    code === '23503' ||
    msg.includes('cora_empresas_client_id_fkey') ||
    msg.includes('violates foreign key constraint') ||
    blob.includes('cora_empresas_client_id_fkey')
  ) {
    return 'Não é possível excluir: ainda há vínculos (Cora, contratos, etc.). Remova-os na tela correspondente ou aplique a migration ON DELETE CASCADE no Supabase.';
  }
  return msg || 'Erro ao excluir cliente.';
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Client;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { data: result, error } = await supabase
        .from('clients')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar cliente', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }) => {
      const { data: result, error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar cliente', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkImportClients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (parsedRows: ParsedImportRow[]) => {
      const { data: existing, error: loadErr } = await supabase.from('clients').select('id, document');
      if (loadErr) throw loadErr;

      const byDigits = new Map<string, string>();
      for (const c of existing ?? []) {
        if (!c.document) continue;
        const k = onlyDigitsDoc(c.document);
        if (k.length >= 11 && !byDigits.has(k)) byDigits.set(k, c.id);
      }

      let inserted = 0;
      let updated = 0;
      const failures: string[] = [];

      for (const row of parsedRows) {
        const id = byDigits.get(row.documentDigits);
        try {
          if (id) {
            const update: Partial<ClientFormData> = {
              name: row.payload.name,
              document: row.payload.document,
              document_type: row.payload.document_type ?? 'CNPJ',
            };
            row.touchedOptional.forEach((key) => {
              (update as Record<string, unknown>)[key] = row.payload[key];
            });
            const { error } = await supabase.from('clients').update(update).eq('id', id);
            if (error) throw error;
            updated++;
          } else {
            const { data: created, error } = await supabase
              .from('clients')
              .insert(row.payload)
              .select('id')
              .single();
            if (error) throw error;
            if (created?.id) byDigits.set(row.documentDigits, created.id);
            inserted++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failures.push(`Linha ${row.lineNumber}: ${msg}`);
        }
      }

      return { inserted, updated, failures };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // 1) Apagar empresas Cora do cliente (cascade em boletos/envios).
      const { data: coraRows, error: coraSelectErr } = await supabase
        .from('cora_empresas')
        .select('id')
        .eq('client_id', id);
      if (coraSelectErr) throw coraSelectErr;
      const coraIds = (coraRows ?? []).map((r: { id: string }) => r.id);
      if (coraIds.length > 0) {
        const { error: coraDelErr } = await supabase.from('cora_empresas').delete().in('id', coraIds);
        if (coraDelErr) throw coraDelErr;
      }
      // 2) Garantir que nenhuma FK reste (ex.: RLS/paginação): zera client_id residual.
      const { error: unlinkErr } = await supabase.from('cora_empresas').update({ client_id: null }).eq('client_id', id);
      if (unlinkErr) throw unlinkErr;

      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['cora_empresas'] });
      queryClient.invalidateQueries({ queryKey: ['cora_boletos'] });
      toast({ title: 'Cliente excluído com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir cliente',
        description: deleteClientFriendlyMessage(error),
        variant: 'destructive',
      });
    },
  });
}
