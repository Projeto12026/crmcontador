import { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, RefreshCw, Send, Settings2, Play } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GuideType,
  GclickGuideJob,
  useGclickGuideJobs,
  useGclickSyncConfig,
  useRunGclickCycle,
  useSendGclickGuides,
  useSyncGclickGuides,
  useUpsertGclickSyncConfig,
} from '@/hooks/useGclickGuides';

function formatCompetencia(mes: number, ano: number) {
  return `${String(mes).padStart(2, '0')}/${ano}`;
}

function toDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

function defaultPatternsFor(type: GuideType): string[] {
  return type === 'INSS' ? ['inss', 'gps', 'previdencia'] : ['fgts', 'sefip', 'grf'];
}

function statusBadgeVariant(status: GclickGuideJob['status']) {
  if (status === 'SENT') return 'default';
  if (status === 'FAILED') return 'destructive';
  if (status === 'FOUND' || status === 'QUEUED') return 'secondary';
  return 'outline';
}

export function GClickGuidesPage() {
  const now = new Date();
  const [competenciaAno, setCompetenciaAno] = useState(now.getFullYear());
  const [competenciaMes, setCompetenciaMes] = useState(now.getMonth() + 1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: jobs, isLoading: loadingJobs } = useGclickGuideJobs(competenciaAno, competenciaMes);
  const { data: config, isLoading: loadingConfig } = useGclickSyncConfig();
  const syncGuides = useSyncGclickGuides();
  const sendGuides = useSendGclickGuides();
  const runCycle = useRunGclickCycle();
  const upsertConfig = useUpsertGclickSyncConfig();

  const [isEnabled, setIsEnabled] = useState(false);
  const [askSendConfirmationOnSync, setAskSendConfirmationOnSync] = useState(false);
  const [runMode, setRunMode] = useState<'sync_only' | 'sync_and_send'>('sync_only');
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [inssPatterns, setInssPatterns] = useState(defaultPatternsFor('INSS').join(', '));
  const [fgtsPatterns, setFgtsPatterns] = useState(defaultPatternsFor('FGTS').join(', '));

  useEffect(() => {
    if (!config) return;
    setIsEnabled(config.is_enabled);
    setAskSendConfirmationOnSync(!!config.ask_send_confirmation_on_sync);
    setRunMode((config.run_mode as 'sync_only' | 'sync_and_send') || 'sync_only');
    setIntervalMinutes(config.interval_minutes || 5);
    const patterns = (config.match_patterns || {}) as Record<string, string[]>;
    setInssPatterns((patterns.INSS || defaultPatternsFor('INSS')).join(', '));
    setFgtsPatterns((patterns.FGTS || defaultPatternsFor('FGTS')).join(', '));
    if (config.competencia_ano) setCompetenciaAno(config.competencia_ano);
    if (config.competencia_mes) setCompetenciaMes(config.competencia_mes);
  }, [config]);

  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const selectableJobs = useMemo(
    () => (jobs || []).filter((j) => j.status !== 'SENT'),
    [jobs],
  );

  const allSelected = selectableJobs.length > 0 && selectedIds.length === selectableJobs.length;

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(selectableJobs.map((j) => j.id));
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((v) => v !== id);
    });
  };

  const handleSync = async () => {
    try {
      const result = await syncGuides.mutateAsync({
        competenciaMes,
        competenciaAno,
        types: ['INSS', 'FGTS'],
        onlyEnabledClients: true,
      });

      if (!askSendConfirmationOnSync) return;
      if (!result?.pendingToSend || result.pendingToSend <= 0) return;
      if (runMode === 'sync_and_send') return;

      const confirmSend = window.confirm(
        `Foram encontradas ${result.pendingToSend} guia(s) pendentes sem log de envio.\nDeseja enviar agora?`,
      );
      if (!confirmSend) return;

      sendGuides.mutate({
        sendAll: true,
        competenciaMes,
        competenciaAno,
      });
    } catch {
      // Erro já tratado no hook com toast.
    }
  };

  const handleSendSelected = () => {
    if (!selectedIds.length) return;
    sendGuides.mutate({
      jobIds: selectedIds,
      competenciaMes,
      competenciaAno,
    });
  };

  const handleSendAll = () => {
    sendGuides.mutate({
      sendAll: true,
      competenciaMes,
      competenciaAno,
    });
  };

  const handleSaveConfig = () => {
    const normalizePatterns = (raw: string, fallback: string[]) => {
      const list = raw
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      return list.length ? list : fallback;
    };

    upsertConfig.mutate({
      is_enabled: isEnabled,
      ask_send_confirmation_on_sync: askSendConfirmationOnSync,
      run_mode: runMode,
      interval_minutes: Math.max(5, intervalMinutes || 5),
      competencia_mes: competenciaMes,
      competencia_ano: competenciaAno,
      match_patterns: {
        INSS: normalizePatterns(inssPatterns, defaultPatternsFor('INSS')),
        FGTS: normalizePatterns(fgtsPatterns, defaultPatternsFor('FGTS')),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração GClick - WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Sincronização e envio de guias INSS/FGTS por competência para clientes marcados com Envia via Gclick.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Competência e ações
          </CardTitle>
          <CardDescription>
            Selecione a competência ativa e execute sincronização/envio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Select value={String(competenciaMes)} onValueChange={(v) => setCompetenciaMes(Number(v))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes, idx) => (
                    <SelectItem key={mes} value={String(idx + 1)}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(competenciaAno)} onValueChange={(v) => setCompetenciaAno(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">{formatCompetencia(competenciaMes, competenciaAno)}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleSync} disabled={syncGuides.isPending}>
                {syncGuides.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sincronizar
              </Button>
              <Button variant="outline" onClick={handleSendSelected} disabled={sendGuides.isPending || selectedIds.length === 0}>
                {sendGuides.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Enviar selecionadas
              </Button>
              <Button onClick={handleSendAll} disabled={sendGuides.isPending}>
                {sendGuides.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Enviar todas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Rotina automática (5 min+)
          </CardTitle>
          <CardDescription>
            Configure o ciclo automático de sincronização e envio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="gclick-enable">Ativar rotina</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, o backend executa ciclos de acordo com o intervalo configurado.
              </p>
            </div>
            <Switch id="gclick-enable" checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="gclick-ask-send-on-sync">Perguntar envio após sincronizar</Label>
              <p className="text-xs text-muted-foreground">
                Ao finalizar a sincronização manual, pergunta se deseja enviar guias pendentes sem log de envio.
              </p>
            </div>
            <Switch
              id="gclick-ask-send-on-sync"
              checked={askSendConfirmationOnSync}
              onCheckedChange={setAskSendConfirmationOnSync}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={runMode} onValueChange={(v) => setRunMode(v as 'sync_only' | 'sync_and_send')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sync_only">sync_only</SelectItem>
                  <SelectItem value="sync_and_send">sync_and_send</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Intervalo (minutos)</Label>
              <Input
                type="number"
                min={5}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Última execução</Label>
              <Input
                value={config?.last_run_at ? new Date(config.last_run_at).toLocaleString('pt-BR') : 'Ainda não executado'}
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Padrões INSS (separados por vírgula)</Label>
              <Textarea
                rows={3}
                value={inssPatterns}
                onChange={(e) => setInssPatterns(e.target.value)}
                placeholder="inss, gps, previdencia"
              />
            </div>
            <div className="space-y-2">
              <Label>Padrões FGTS (separados por vírgula)</Label>
              <Textarea
                rows={3}
                value={fgtsPatterns}
                onChange={(e) => setFgtsPatterns(e.target.value)}
                placeholder="fgts, sefip, grf"
              />
            </div>
          </div>

          {config?.last_run_error ? (
            <p className="text-sm text-destructive">Último erro: {config.last_run_error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveConfig} disabled={upsertConfig.isPending || loadingConfig}>
              {upsertConfig.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar configuração
            </Button>
            <Button variant="outline" onClick={() => runCycle.mutate()} disabled={runCycle.isPending}>
              {runCycle.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Executar 1 ciclo agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Guias encontradas</CardTitle>
          <CardDescription>
            Resultado da competência {formatCompetencia(competenciaMes, competenciaAno)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingJobs ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !jobs?.length ? (
            <div className="text-sm text-muted-foreground py-6">
              Nenhuma guia encontrada para esta competência.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">
                    <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tentativas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const checked = selectedIds.includes(job.id);
                  const canSelect = job.status !== 'SENT';
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={!canSelect}
                          onCheckedChange={(v) => toggleOne(job.id, Boolean(v))}
                        />
                      </TableCell>
                      <TableCell>{job.clients?.name || '-'}</TableCell>
                      <TableCell className="font-mono">{toDigits(job.client_document)}</TableCell>
                      <TableCell>{job.guide_type}</TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {job.arquivo_nome || job.arquivo_url}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{job.attempts}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
