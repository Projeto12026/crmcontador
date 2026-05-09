import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  Filter,
  ArrowLeftRight,
  MessageCircle,
  TrendingUp,
  Info,
} from 'lucide-react';
import {
  useCoraEnviosReport,
  useCoraEmpresas,
  type CoraEnvio,
} from '@/hooks/useCora';

const TIPO_ENVIO_LABELS: Record<string, string> = {
  AVISO_5_ANTES: 'Aviso 5 dias antes',
  LEMBRETE_DIA: 'Lembrete no dia',
  AVISO_2_ATRASO: 'Aviso 2 dias após',
  AVISO_5_ATRASO: 'Aviso 5 dias após',
  INDIVIDUAL_MANUAL: 'Envio manual',
};

const PROVIDER_LABELS: Record<string, { label: string; tone: 'wascript' | 'lion' }> = {
  wascript: { label: 'Wascript', tone: 'wascript' },
  lion_crm: { label: 'Lion CRM', tone: 'lion' },
};

function defaultRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { startDate: fmt(from), endDate: fmt(today) };
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Extrai provider/failover do campo `detalhe` quando as colunas dedicadas
 * não existem ainda (modo fallback enquanto a migração não foi aplicada).
 * Formato esperado: `[provider=wascript]` ou `[provider=lion_crm failover]`.
 */
function extractFromDetalhe(detalhe: string | null): { provider: string | null; failover: boolean } {
  if (!detalhe) return { provider: null, failover: false };
  const match = /\[([^\]]+)\]/.exec(detalhe);
  if (!match) return { provider: null, failover: false };
  const tags = match[1].split(/\s+/);
  let provider: string | null = null;
  let failover = false;
  for (const t of tags) {
    if (t.startsWith('provider=')) provider = t.slice('provider='.length);
    else if (t === 'failover') failover = true;
  }
  return { provider, failover };
}

function getEffectiveProvider(envio: CoraEnvio): { provider: string | null; failover: boolean; fromFallback: boolean } {
  if (envio.provider) {
    return { provider: envio.provider, failover: !!envio.failover, fromFallback: false };
  }
  const fb = extractFromDetalhe(envio.detalhe);
  return { provider: fb.provider, failover: fb.failover, fromFallback: !!fb.provider };
}

function ProviderBadge({ provider, failover }: { provider: string | null; failover: boolean | null }) {
  if (!provider) return <Badge variant="outline" className="text-xs">—</Badge>;
  const meta = PROVIDER_LABELS[provider];
  if (!meta) {
    return (
      <Badge variant="outline" className="text-xs">
        {provider}
      </Badge>
    );
  }
  const className =
    meta.tone === 'wascript'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-amber-100 text-amber-800 border-amber-200';
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="outline" className={`text-xs ${className}`}>
        {meta.label}
      </Badge>
      {failover ? (
        <span title="Provedor primário falhou; envio caiu para o secundário">
          <ArrowLeftRight className="h-3.5 w-3.5 text-orange-600" />
        </span>
      ) : null}
    </span>
  );
}

function exportToCsv(rows: CoraEnvio[], empresaNome: (id: string | null) => string) {
  const header = [
    'Data/Hora',
    'Empresa',
    'Competência',
    'Canal',
    'Tipo',
    'Provedor',
    'Provedor PDF',
    'Provedor Texto',
    'Failover',
    'Sucesso',
    'Detalhe',
  ];
  const csv = [
    header.join(';'),
    ...rows.map((r) =>
      [
        formatDateTime(r.created_at),
        empresaNome(r.empresa_id),
        r.competencia_mes && r.competencia_ano
          ? `${String(r.competencia_mes).padStart(2, '0')}/${r.competencia_ano}`
          : '',
        r.canal || '',
        r.tipo_envio || '',
        r.provider || '',
        r.provider_pdf || '',
        r.provider_text || '',
        r.failover ? 'sim' : 'não',
        r.sucesso ? 'sim' : 'não',
        (r.detalhe || '').replace(/[\r\n;]/g, ' '),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  link.href = url;
  link.download = `relatorio-envios-cora-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function RelatoriosEnvioTab() {
  const { startDate: defStart, endDate: defEnd } = useMemo(defaultRange, []);
  const [startDate, setStartDate] = useState(defStart);
  const [endDate, setEndDate] = useState(defEnd);
  const [provider, setProvider] = useState<string>('all');
  const [sucesso, setSucesso] = useState<'all' | 'true' | 'false'>('all');
  const [tipoEnvio, setTipoEnvio] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: empresas } = useCoraEmpresas();
  const { data, isLoading, refetch, isFetching } = useCoraEnviosReport({
    startDate,
    endDate,
    provider,
    sucesso,
    tipoEnvio,
  });

  const empresaNome = (id: string | null) => {
    if (!id) return '—';
    const e = empresas?.find((x) => x.id === id);
    return e?.client_name || e?.cnpj || '—';
  };

  const rows = data || [];
  const totals = useMemo(() => {
    const t = {
      total: rows.length,
      sucesso: 0,
      falha: 0,
      wascript: 0,
      lion_crm: 0,
      sem_provider: 0,
      failover: 0,
      individual: 0,
      automatico: 0,
      fallbackUsed: false,
    };
    for (const r of rows) {
      if (r.sucesso) t.sucesso++;
      else t.falha++;
      const eff = getEffectiveProvider(r);
      if (eff.fromFallback) t.fallbackUsed = true;
      if (eff.provider === 'wascript') t.wascript++;
      else if (eff.provider === 'lion_crm') t.lion_crm++;
      else t.sem_provider++;
      if (eff.failover) t.failover++;
      if (r.tipo_envio === 'INDIVIDUAL_MANUAL') t.individual++;
      else if (r.tipo_envio) t.automatico++;
    }
    return t;
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleResetFilters = () => {
    const { startDate: s, endDate: e } = defaultRange();
    setStartDate(s);
    setEndDate(e);
    setProvider('all');
    setSucesso('all');
    setTipoEnvio('all');
    setPage(0);
  };

  return (
    <div className="space-y-4">
      {totals.fallbackUsed ? (
        <Alert className="border-amber-300 bg-amber-50">
          <Info className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">Migração pendente no Supabase</AlertTitle>
          <AlertDescription className="text-amber-900 text-xs">
            Detectei envios cujo provedor está armazenado no campo <code>detalhe</code>{' '}
            (modo de compatibilidade). Os badges abaixo já leem esses registros, mas para
            ter filtros e índices nativos por provedor é necessário aplicar o SQL{' '}
            <code>supabase/migrations/20260509160000_cora_envios_provider.sql</code> no
            Supabase. Após a migração, novos envios passam a usar colunas dedicadas
            automaticamente.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros do relatório
          </CardTitle>
          <CardDescription>
            Os envios são gravados na tabela cora_envios com o provedor que efetivamente entregou
            (Wascript ou Lion CRM). O failover é destacado quando o primário falhou.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="rep-start">Data inicial</Label>
              <Input
                id="rep-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-end">Data final</Label>
              <Input
                id="rep-end"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Provedor</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="wascript">Wascript</SelectItem>
                  <SelectItem value="lion_crm">Lion CRM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Resultado</Label>
              <Select
                value={sucesso}
                onValueChange={(v) => {
                  setSucesso(v as 'all' | 'true' | 'false');
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Apenas sucesso</SelectItem>
                  <SelectItem value="false">Apenas falha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de envio</Label>
              <Select
                value={tipoEnvio}
                onValueChange={(v) => {
                  setTipoEnvio(v);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="INDIVIDUAL_MANUAL">Manual (individual)</SelectItem>
                  <SelectItem value="AVISO_5_ANTES">Automático — 5 dias antes</SelectItem>
                  <SelectItem value="LEMBRETE_DIA">Automático — lembrete no dia</SelectItem>
                  <SelectItem value="AVISO_2_ATRASO">Automático — 2 dias após</SelectItem>
                  <SelectItem value="AVISO_5_ATRASO">Automático — 5 dias após</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => refetch()} disabled={isFetching} size="sm">
              {isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Filter className="mr-2 h-4 w-4" />
              )}
              Aplicar filtros
            </Button>
            <Button onClick={handleResetFilters} variant="outline" size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button
              onClick={() => exportToCsv(rows, empresaNome)}
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV ({rows.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Total no período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.total}</div>
            <p className="text-xs text-muted-foreground">
              {totals.sucesso} sucesso · {totals.falha} falha
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              Wascript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.wascript}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total ? Math.round((totals.wascript / totals.total) * 100) : 0}% dos envios
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-amber-600" />
              Lion CRM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.lion_crm}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total ? Math.round((totals.lion_crm / totals.total) * 100) : 0}% dos envios
              {totals.failover > 0 ? ` · ${totals.failover} via failover` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ArrowLeftRight className="h-4 w-4 text-purple-600" />
              Manual vs Automático
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.individual} <span className="text-base text-muted-foreground">/ {totals.automatico}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.individual} envio(s) manual(is) · {totals.automatico} automáticos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Envios</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Carregando...'
              : rows.length === 0
              ? 'Nenhum envio encontrado para os filtros selecionados.'
              : `Exibindo ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, rows.length)} de ${rows.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => {
                      const eff = getEffectiveProvider(r);
                      return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(r.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">{empresaNome(r.empresa_id)}</TableCell>
                        <TableCell className="text-xs">
                          {r.competencia_mes && r.competencia_ano
                            ? `${String(r.competencia_mes).padStart(2, '0')}/${r.competencia_ano}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.tipo_envio
                            ? TIPO_ENVIO_LABELS[r.tipo_envio] || r.tipo_envio
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{r.canal || '—'}</TableCell>
                        <TableCell>
                          <ProviderBadge provider={eff.provider} failover={eff.failover} />
                        </TableCell>
                        <TableCell>
                          {r.sucesso ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Sucesso
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              <XCircle className="mr-1 h-3 w-3" />
                              Falha
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs" title={r.detalhe || ''}>
                          {r.detalhe || '—'}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 ? (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
