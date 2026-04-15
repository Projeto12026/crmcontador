import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type GuideType = 'INSS' | 'FGTS';
export type GuideJobStatus = 'FOUND' | 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';
export type GclickRunMode = 'sync_only' | 'sync_and_send';

export interface GclickGuideJob {
  id: string;
  client_id: string;
  client_document: string;
  guide_type: GuideType;
  competencia_mes: number;
  competencia_ano: number;
  task_id: string | null;
  atividade_id: string | null;
  arquivo_nome: string | null;
  arquivo_url: string;
  status: GuideJobStatus;
  last_error: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: { id: string; name: string; phone: string | null } | null;
}

export interface GclickSyncConfig {
  id: string;
  is_enabled: boolean;
  ask_send_confirmation_on_sync: boolean;
  run_mode: GclickRunMode;
  interval_minutes: number;
  competencia_mes: number | null;
  competencia_ano: number | null;
  match_patterns: Record<string, string[]> | null;
  last_run_at: string | null;
  last_run_error: string | null;
  updated_at: string;
}

async function resolveBackendBaseUrl(): Promise<string> {
  const { data } = await supabase
    .from('cora_config')
    .select('valor')
    .eq('chave', 'cora_api')
    .maybeSingle();

  const tokenUrl = (data?.valor as { backend_token_url?: string } | null)?.backend_token_url || '';
  if (!tokenUrl) return '';

  try {
    return new URL(tokenUrl).origin;
  } catch {
    return '';
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let parsed: T | null = null;
  try {
    parsed = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: resposta inválida do backend.`);
    }
    throw new Error('Resposta inválida do backend.');
  }

  if (!response.ok) {
    const maybeErr = parsed as { error?: string; message?: string };
    throw new Error(maybeErr?.error || maybeErr?.message || `Erro HTTP ${response.status}`);
  }
  return parsed;
}

export function useGclickGuideJobs(competenciaAno?: number, competenciaMes?: number) {
  return useQuery({
    queryKey: ['gclick_guide_jobs', competenciaAno, competenciaMes],
    queryFn: async () => {
      let query = supabase
        .from('gclick_guide_jobs')
        .select('*, clients(id, name, phone)')
        .order('created_at', { ascending: false });

      if (competenciaAno) query = query.eq('competencia_ano', competenciaAno);
      if (competenciaMes) query = query.eq('competencia_mes', competenciaMes);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        clients: row.clients || null,
      })) as GclickGuideJob[];
    },
  });
}

export function useGclickSyncConfig() {
  return useQuery({
    queryKey: ['gclick_sync_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gclick_sync_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data || null) as GclickSyncConfig | null;
    },
  });
}

export function useUpsertGclickSyncConfig() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Partial<GclickSyncConfig>) => {
      const { data: existing, error: loadError } = await supabase
        .from('gclick_sync_config')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (loadError) throw loadError;

      if (existing?.id) {
        const { error } = await supabase
          .from('gclick_sync_config')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('gclick_sync_config').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gclick_sync_config'] });
      toast({ title: 'Configuração da rotina salva.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar configuração',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSyncGclickGuides() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      competenciaMes: number;
      competenciaAno: number;
      types?: GuideType[];
      onlyEnabledClients?: boolean;
    }) => {
      const base = await resolveBackendBaseUrl();
      const response = await fetch(`${base}/api/gclick/sync-guides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return parseJsonResponse<{
        success: boolean;
        found: number;
        queued: number;
        skipped: number;
        errors: number;
        pendingToSend: number;
        alreadySent: number;
      }>(response);
    },
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['gclick_guide_jobs', vars.competenciaAno, vars.competenciaMes] });
      toast({
        title: 'Sincronização concluída',
        description: `Encontradas ${result.found} guias.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSendGclickGuides() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      jobIds?: string[];
      sendAll?: boolean;
      competenciaMes: number;
      competenciaAno: number;
    }) => {
      const base = await resolveBackendBaseUrl();
      const response = await fetch(`${base}/api/gclick/send-guides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return parseJsonResponse<{
        success: boolean;
        sent: number;
        failed: number;
        skipped: number;
      }>(response);
    },
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ['gclick_guide_jobs', vars.competenciaAno, vars.competenciaMes] });
      toast({ title: 'Envio finalizado.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro no envio', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRunGclickCycle() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const base = await resolveBackendBaseUrl();
      const response = await fetch(`${base}/api/gclick/run-cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return parseJsonResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gclick_sync_config'] });
      qc.invalidateQueries({ queryKey: ['gclick_guide_jobs'] });
      toast({ title: 'Ciclo executado com sucesso.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao executar ciclo', description: error.message, variant: 'destructive' });
    },
  });
}
