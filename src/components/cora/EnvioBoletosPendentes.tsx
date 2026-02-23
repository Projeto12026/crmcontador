import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send, Loader2, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, ChevronUp, X, Info, Phone,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCoraConfig, useCoraMessageTemplates, CoraEmpresa, CoraBoleto, CoraMessageTemplate } from '@/hooks/useCora';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

type BoletoStatus = 'PAID' | 'OPEN' | 'LATE' | 'CANCELLED' | 'DRAFT' | 'UNKNOWN' | 'PENDING';

type SendType = 'ALL_PENDING' | 'OPEN' | 'LATE' | 'REMINDER';

interface EmpresaComStatus extends CoraEmpresa {
  boletoStatus: BoletoStatus;
  boleto: CoraBoleto | null;
}

interface EnvioResultado {
  success: boolean;
  empresaId: string;
  empresa: string;
  error?: string;
  etapa?: string;
  cnpj?: string;
  status?: string;
  mensagemEnviada?: boolean;
  pdfEnviado?: boolean;
  lembreteEnviado?: boolean;
  diasAtraso?: number;
  valor?: number;
}

interface EnvioResult {
  success: boolean;
  message: string;
  sucessos: number;
  erros: number;
  total: number;
  resultados: EnvioResultado[];
  timestamp: string;
}

interface Props {
  empresasComStatus: EmpresaComStatus[];
  competenciaMes: number;
  competenciaAno: number;
}

function parseLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

function gerarDataVencimento(diaVencimento: number, mes: number, ano: number): Date {
  const lastDay = new Date(ano, mes, 0).getDate();
  const dia = Math.min(diaVencimento, lastDay);
  return new Date(ano, mes - 1, dia);
}

const STORAGE_KEY = 'ultimo_envio_boletos_cora';

/** Mensagem amigável para erros temporários de WhatsApp (token/sessão); incentiva nova tentativa. */
function formatEnvioErrorMessage(error: string | undefined): string {
  if (!error) return '';
  const lower = error.toLowerCase();
  if (lower.includes('reconecte') || lower.includes('sessão whatsapp') || lower.includes('desconectad') || (lower.includes('erro desconhecido') && lower.includes('token'))) {
    return 'Falha temporária na conexão com o WhatsApp. Tente enviar novamente em alguns segundos.';
  }
  return error;
}

export function EnvioBoletosPendentes({ empresasComStatus, competenciaMes, competenciaAno }: Props) {
  const { toast } = useToast();
  const { data: configs } = useCoraConfig();
  const { data: templates } = useCoraMessageTemplates();
  // State
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<EnvioResult | null>(null);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState<Set<string>>(new Set());
  const [filtroStatus, setFiltroStatus] = useState('ALL');
  const [filtroFormaEnvio, setFiltroFormaEnvio] = useState('ALL');
  const [marcarTodos, setMarcarTodos] = useState(false);
  const [somenteProximos, setSomenteProximos] = useState(false);
  const [diasProximos, setDiasProximos] = useState(3);
  const [sendType, setSendType] = useState<SendType>('ALL_PENDING');
  const [mostrarErrosUltimoEnvio, setMostrarErrosUltimoEnvio] = useState(true);
  const [ultimoEnvioComErros, setUltimoEnvioComErros] = useState<EnvioResult | null>(null);
  const [ultimoEnvioCompleto, setUltimoEnvioCompleto] = useState<EnvioResult | null>(null);
  const [mostrarDetalhesUltimoEnvio, setMostrarDetalhesUltimoEnvio] = useState(false);

  // Load last send from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const dados = JSON.parse(stored) as EnvioResult;
        if (dados.erros > 0 || dados.sucessos > 0) {
          setResultado(dados);
          setUltimoEnvioCompleto(dados);
          if (dados.erros > 0) {
            setUltimoEnvioComErros(dados);
            setMostrarErrosUltimoEnvio(true);
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Backend URL: use config backend_token_url base or fallback to relative (nginx proxy in Docker)
  const backendUrl = useMemo(() => {
    const apiCfg = configs?.find(c => c.chave === 'cora_api');
    const tokenUrl = (apiCfg?.valor as any)?.backend_token_url || '';
    if (tokenUrl) {
      // Extract base URL from backend_token_url (e.g., https://crm.controledinheiro.com.br/api/cora/get-token -> https://crm.controledinheiro.com.br)
      try {
        const url = new URL(tokenUrl);
        return url.origin;
      } catch {
        return '';
      }
    }
    return '';
  }, [configs]);

  const wascriptConfig = useMemo(() => {
    const wpp = configs?.find(c => c.chave === 'whatsapp');
    return {
      apiUrl: (wpp?.valor as any)?.api_url || '',
      token: (wpp?.valor as any)?.token || '',
    };
  }, [configs]);

  const competencia = `${String(competenciaMes).padStart(2, '0')}/${competenciaAno}`;

  // Resolve template message with variables
  const resolveTemplate = useCallback((templateKey: string, empresa: EmpresaComStatus): string => {
    const template = templates?.find(t => t.template_key === templateKey && t.is_active);
    if (!template) return '';
    const nome = empresa.client_name || empresa.client?.name || 'Cliente';
    const amount = empresa.boleto?.total_amount_cents
      ? empresa.boleto.total_amount_cents / 100
      : empresa.valor_mensal || 0;
    const valor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(amount);
    const dueDate = empresa.boleto?.due_date
      ? parseLocalDate(empresa.boleto.due_date)
      : gerarDataVencimento(empresa.dia_vencimento, competenciaMes, competenciaAno);
    const vencimento = dueDate
      ? dueDate.toLocaleDateString('pt-BR')
      : `${String(empresa.dia_vencimento).padStart(2, '0')}/${String(competenciaMes).padStart(2, '0')}/${competenciaAno}`;
    const dias = getDiasAtraso(empresa);

    return template.message_body
      .replace(/\{\{nome\}\}/g, nome)
      .replace(/\{\{competencia\}\}/g, competencia)
      .replace(/\{\{vencimento\}\}/g, vencimento)
      .replace(/\{\{valor\}\}/g, valor)
      .replace(/\{\{dias_atraso\}\}/g, dias != null ? String(dias) : '0');
  }, [templates, competencia, competenciaMes, competenciaAno]);

  // Pipeline: filter empresas
  const empresasPendentes = useMemo(() => {
    let filtered = empresasComStatus.filter(e => {
      if (filtroStatus !== 'ALL' && e.boletoStatus !== filtroStatus) return false;
      if (filtroFormaEnvio !== 'ALL' && e.forma_envio !== filtroFormaEnvio) return false;
      return true;
    });

    // Only pending statuses
    filtered = filtered.filter(e => ['OPEN', 'LATE', 'PENDING', 'UNKNOWN'].includes(e.boletoStatus));

    // Adjust by sendType
    if (sendType === 'OPEN') {
      filtered = filtered.filter(e => e.boletoStatus === 'OPEN' || e.boletoStatus === 'PENDING' || e.boletoStatus === 'UNKNOWN');
    } else if (sendType === 'LATE') {
      filtered = filtered.filter(e => e.boletoStatus === 'LATE');
    } else if (sendType === 'REMINDER') {
      filtered = filtered.filter(e => e.boletoStatus !== 'LATE');
    }

    // Filter by proximity
    if (somenteProximos && sendType === 'REMINDER') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      filtered = filtered.filter(e => {
        if (e.boletoStatus === 'LATE') return false;
        const dueDate = e.boleto?.due_date
          ? parseLocalDate(e.boleto.due_date)
          : gerarDataVencimento(e.dia_vencimento, competenciaMes, competenciaAno);
        if (!dueDate) return false;
        const diffMs = dueDate.getTime() - hoje.getTime();
        const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diasProximos === 0) return diffDias === 0;
        return diffDias >= 0 && diffDias <= diasProximos;
      });
    }

    return filtered;
  }, [empresasComStatus, filtroStatus, filtroFormaEnvio, sendType, somenteProximos, diasProximos, competenciaMes, competenciaAno]);

  // Selection handlers
  const handleMarcarTodos = useCallback((checked: boolean) => {
    if (checked) {
      setEmpresasSelecionadas(new Set(empresasPendentes.map(e => e.id)));
    } else {
      setEmpresasSelecionadas(new Set());
    }
    setMarcarTodos(checked);
  }, [empresasPendentes]);

  const handleSelecionarEmpresa = useCallback((empresaId: string, checked: boolean) => {
    setEmpresasSelecionadas(prev => {
      const next = new Set(prev);
      if (checked) next.add(empresaId);
      else next.delete(empresaId);
      setMarcarTodos(empresasPendentes.length > 0 && empresasPendentes.every(e => next.has(e.id)));
      return next;
    });
  }, [empresasPendentes]);

  // Compute days late for display
  const getDiasAtraso = (emp: EmpresaComStatus): number | null => {
    if (emp.boletoStatus !== 'LATE') return null;
    const dueDate = emp.boleto?.due_date
      ? parseLocalDate(emp.boleto.due_date)
      : gerarDataVencimento(emp.dia_vencimento, competenciaMes, competenciaAno);
    if (!dueDate) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((hoje.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
  };

  // Log envio to cora_envios
  const logEnvio = async (empresaId: string, boletoId: string | null, canal: string, sucesso: boolean, detalhe: string) => {
    try {
      await supabase.from('cora_envios').insert({
        empresa_id: empresaId,
        boleto_id: boletoId,
        competencia_mes: competenciaMes,
        competencia_ano: competenciaAno,
        canal,
        sucesso,
        detalhe,
      });
    } catch { /* best effort */ }
  };

  // Send boletos (PDF + message)
  const handleEnviarBoletosSelecionados = async () => {
    if (empresasSelecionadas.size === 0) {
      toast({ title: 'Selecione ao menos uma empresa', variant: 'destructive' });
      return;
    }

    setEnviando(true);
    setResultado(null);

    let sucessos = 0;
    let erros = 0;
    const resultados: EnvioResultado[] = [];

    for (const empresaId of empresasSelecionadas) {
      const empresa = empresasComStatus.find(e => e.id === empresaId);
      if (!empresa) continue;

      try {
        const tel = empresa.telefone?.trim();
        if (!tel || tel.length < 10) {
          throw new Error(`Telefone inválido ou ausente para ${empresa.client_name || empresa.cnpj}. Cadastre um telefone com pelo menos 10 dígitos.`);
        }

        // Resolve message template based on status
        const templateKey = empresa.boletoStatus === 'LATE' ? 'after_due' : 'before_due';
        const mensagem = resolveTemplate(templateKey, empresa);
        if (!mensagem.trim()) {
          throw new Error(`Template de mensagem "${templateKey}" não encontrado ou inativo. Ative o template em Parâmetros do Cora.`);
        }

        const response = await fetch(`${backendUrl}/api/notifications/whatsapp-optimized/process-boleto-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa: {
              nome: empresa.client_name || empresa.client?.name || '',
              cnpj: empresa.cnpj,
              telefone: tel,
              apelido: empresa.client_name || '',
            },
            competencia,
            invoiceId: empresa.boleto?.cora_invoice_id || undefined,
            mensagem,
            templateKey,
            wascriptApiUrl: wascriptConfig.apiUrl,
            wascriptToken: wascriptConfig.token,
          }),
        });

        const responseText = await response.text();
        let sendResult: any;
        try {
          sendResult = responseText ? JSON.parse(responseText) : null;
        } catch {
          console.error(`[Cora] Resposta não-JSON (status ${response.status}):`, responseText.slice(0, 300));
          throw new Error(`Resposta inválida do backend (status ${response.status}). O corpo não é JSON. Verifique se a URL do backend está correta e a rota /api/notifications/whatsapp-optimized/process-boleto-complete existe.`);
        }

        if (!response.ok) {
          const msg = sendResult?.error || sendResult?.message || sendResult?.details || `Erro HTTP ${response.status}`;
          console.error(`[Cora] Erro ${response.status}:`, sendResult);
          throw new Error(msg);
        }

        if (sendResult && typeof sendResult.success === 'boolean' && !sendResult.success) {
          throw new Error(sendResult.error || sendResult.message || 'Erro no processamento do boleto');
        }

        sucessos++;
        resultados.push({
          success: true,
          empresaId,
          empresa: empresa.client_name || empresa.cnpj,
          status: empresa.boletoStatus,
          mensagemEnviada: true,
          pdfEnviado: true,
          diasAtraso: getDiasAtraso(empresa) ?? undefined,
          valor: empresa.valor_mensal,
        });
        await logEnvio(empresaId, empresa.boleto?.id || null, 'WHATSAPP', true, 'Boleto enviado com sucesso');
      } catch (err: any) {
        erros++;
        resultados.push({
          success: false,
          empresaId,
          empresa: empresa.client_name || empresa.cnpj,
          error: err.message,
          cnpj: empresa.cnpj,
          status: empresa.boletoStatus,
        });
        await logEnvio(empresaId, empresa.boleto?.id || null, 'WHATSAPP', false, err.message);
      }

      // Delay between sends
      await new Promise(r => setTimeout(r, 2000));
    }

    const res: EnvioResult = {
      success: true,
      message: `Envio concluído: ${sucessos} sucesso(s), ${erros} erro(s)`,
      sucessos,
      erros,
      total: sucessos + erros,
      resultados,
      timestamp: new Date().toISOString(),
    };

    setResultado(res);
    setUltimoEnvioCompleto(res);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));

    if (erros > 0) {
      setUltimoEnvioComErros(res);
      setMostrarErrosUltimoEnvio(true);
      toast({ title: `${erros} erro(s) no envio`, variant: 'destructive' });
    } else {
      setUltimoEnvioComErros(null);
      toast({ title: `${sucessos} boleto(s) enviado(s) com sucesso!` });
    }

    setEmpresasSelecionadas(new Set());
    setMarcarTodos(false);
    setEnviando(false);
  };

  // Send reminders (text only)
  const handleEnviarLembretesSelecionados = async () => {
    if (empresasSelecionadas.size === 0) {
      toast({ title: 'Selecione ao menos uma empresa', variant: 'destructive' });
      return;
    }

    setEnviando(true);
    setResultado(null);

    let sucessos = 0;
    let erros = 0;
    const resultados: EnvioResultado[] = [];

    for (const empresaId of empresasSelecionadas) {
      const empresa = empresasComStatus.find(e => e.id === empresaId);
      if (!empresa) continue;

      try {
        const dueDate = empresa.boleto?.due_date
          || (() => {
            if (empresa.dia_vencimento) {
              const d = gerarDataVencimento(empresa.dia_vencimento, competenciaMes, competenciaAno);
              return d.toISOString().split('T')[0];
            }
            return undefined;
          })();

        // Check if due today for template selection
        const dueDateObj = dueDate ? parseLocalDate(dueDate) : null;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const isToday = dueDateObj && dueDateObj.getTime() === hoje.getTime();
        const templateKey = isToday ? 'reminder_today' : 'reminder';
        const mensagem = resolveTemplate(templateKey, empresa);
        if (!mensagem.trim()) {
          throw new Error(`Template de mensagem "${templateKey}" não encontrado ou inativo. Ative o template em Parâmetros do Cora.`);
        }

        const response = await fetch(`${backendUrl}/api/notifications/whatsapp-optimized/send-reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa: {
              nome: empresa.client_name || empresa.client?.name || '',
              cnpj: empresa.cnpj,
              telefone: empresa.telefone?.trim() || '',
              apelido: empresa.client_name || '',
              valor: empresa.valor_mensal,
              amount: empresa.boleto?.total_amount_cents ? empresa.boleto.total_amount_cents / 100 : empresa.valor_mensal,
            },
            boleto: {
              due_date: dueDate,
              total_amount: empresa.boleto?.total_amount_cents || (empresa.valor_mensal ? empresa.valor_mensal * 100 : 0),
            },
            mensagem,
            templateKey,
            wascriptApiUrl: wascriptConfig.apiUrl,
            wascriptToken: wascriptConfig.token,
          }),
        });

        const sendResult = await response.json().catch(() => ({ success: false }));
        if (response.ok && sendResult.success !== false) {
          sucessos++;
          resultados.push({
            success: true,
            empresaId,
            empresa: empresa.client_name || empresa.cnpj,
            lembreteEnviado: true,
          });
          await logEnvio(empresaId, empresa.boleto?.id || null, 'WHATSAPP_LEMBRETE', true, 'Lembrete enviado');
        } else {
          throw new Error(sendResult.error || `Erro HTTP ${response.status}`);
        }
      } catch (err: any) {
        erros++;
        resultados.push({
          success: false,
          empresaId,
          empresa: empresa.client_name || empresa.cnpj,
          error: err.message,
        });
        await logEnvio(empresaId, empresa.boleto?.id || null, 'WHATSAPP_LEMBRETE', false, err.message);
      }

      await new Promise(r => setTimeout(r, 800));
    }

    const res: EnvioResult = {
      success: true,
      message: `Lembretes: ${sucessos} sucesso(s), ${erros} erro(s)`,
      sucessos,
      erros,
      total: sucessos + erros,
      resultados,
      timestamp: new Date().toISOString(),
    };

    setResultado(res);
    setUltimoEnvioCompleto(res);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));

    if (erros > 0) {
      setUltimoEnvioComErros(res);
      setMostrarErrosUltimoEnvio(true);
      toast({ title: `${erros} erro(s) no envio de lembretes`, variant: 'destructive' });
    } else {
      setUltimoEnvioComErros(null);
      toast({ title: `${sucessos} lembrete(s) enviado(s)!` });
    }

    setEmpresasSelecionadas(new Set());
    setMarcarTodos(false);
    setEnviando(false);
  };

  // Button label
  const getButtonLabel = () => {
    const count = empresasSelecionadas.size;
    if (enviando) {
      return sendType === 'REMINDER' ? 'Enviando lembretes...' : `Enviando ${count} boleto(s)...`;
    }
    if (sendType === 'REMINDER') return `Enviar lembrete (${count})`;
    if (sendType === 'LATE') return `Enviar boletos vencidos (${count})`;
    if (sendType === 'OPEN') return `Enviar boletos em dia (${count})`;
    return `Enviar boletos pendentes (${count})`;
  };

  const clearLastSend = () => {
    setUltimoEnvioComErros(null);
    setMostrarErrosUltimoEnvio(false);
    setUltimoEnvioCompleto(null);
    setMostrarDetalhesUltimoEnvio(false);
    setResultado(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            Envio Seletivo de Boletos
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {ultimoEnvioCompleto && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMostrarDetalhesUltimoEnvio(v => !v);
                }}
              >
                Ver Último Envio ({ultimoEnvioCompleto.sucessos} ✓, {ultimoEnvioCompleto.erros} ✗)
              </Button>
            )}
            {ultimoEnvioComErros && ultimoEnvioComErros.erros > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/50"
                onClick={() => setMostrarErrosUltimoEnvio(v => !v)}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Ver {ultimoEnvioComErros.erros} Erro(s)
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecione quais clientes receberão seus boletos via WhatsApp. Mensagens personalizadas baseadas no status (vencido ou em dia).
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Last send errors */}
        {ultimoEnvioComErros && ultimoEnvioComErros.erros > 0 && (
          <div id="secao-erros-ultimo-envio" className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-destructive">
                {ultimoEnvioComErros.erros} erro(s) no último envio · {new Date(ultimoEnvioComErros.timestamp).toLocaleString('pt-BR')}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setMostrarErrosUltimoEnvio(v => !v)}>
                  {mostrarErrosUltimoEnvio ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {mostrarErrosUltimoEnvio ? 'Ocultar' : 'Mostrar'}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearLastSend}>
                  <X className="h-4 w-4" /> Limpar
                </Button>
              </div>
            </div>
            {mostrarErrosUltimoEnvio && (
              <div className="space-y-1 mt-2">
                {ultimoEnvioComErros.resultados.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="text-xs p-2 bg-background rounded border border-destructive/20">
                    <span className="font-medium">{r.empresa}</span>
                    {r.etapa && <Badge variant="outline" className="ml-1 text-[10px]">{r.etapa}</Badge>}
                    <span className="text-destructive ml-2">{formatEnvioErrorMessage(r.error)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Last send details */}
        {ultimoEnvioCompleto && mostrarDetalhesUltimoEnvio && (
          <div id="secao-detalhes-ultimo-envio" className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-green-500/10 text-green-700">✓ {ultimoEnvioCompleto.sucessos}</Badge>
              {ultimoEnvioCompleto.erros > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-700">✗ {ultimoEnvioCompleto.erros}</Badge>
              )}
              <Badge variant="outline">Total: {ultimoEnvioCompleto.total}</Badge>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {ultimoEnvioCompleto.resultados.slice(0, 20).map((r, i) => (
                  <div key={i} className="text-xs p-2 bg-muted/50 rounded flex items-center gap-2 flex-wrap">
                    {r.success ? <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" /> : <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />}
                    <span className="font-medium">{r.empresa}</span>
                    {r.success && r.mensagemEnviada && <Badge variant="outline" className="text-[10px]">Mensagem</Badge>}
                    {r.success && r.pdfEnviado && <Badge variant="outline" className="text-[10px]">PDF</Badge>}
                    {r.success && r.lembreteEnviado && <Badge variant="outline" className="text-[10px]">Lembrete</Badge>}
                    {!r.success && <span className="text-destructive text-[10px]">{formatEnvioErrorMessage(r.error)}</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Filters line 1 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de envio</Label>
            <Select value={sendType} onValueChange={v => { setSendType(v as SendType); setEmpresasSelecionadas(new Set()); setMarcarTodos(false); }}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_PENDING">Todos pendentes (PDF + msg)</SelectItem>
                <SelectItem value="OPEN">Em dia / a vencer (PDF + msg)</SelectItem>
                <SelectItem value="LATE">Vencidos (PDF + msg)</SelectItem>
                <SelectItem value="REMINDER">Lembrete (somente msg)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="OPEN">Em Aberto</SelectItem>
                <SelectItem value="LATE">Atrasadas</SelectItem>
                <SelectItem value="UNKNOWN">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Forma Envio</Label>
            <Select value={filtroFormaEnvio} onValueChange={setFiltroFormaEnvio}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filters line 2 */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              checked={marcarTodos}
              onCheckedChange={handleMarcarTodos}
              disabled={empresasPendentes.length === 0}
            />
            <Label className="text-sm">Marcar Todos</Label>
          </div>
          <Badge variant="outline">{empresasSelecionadas.size} selecionada(s)</Badge>

          <div className="flex items-center gap-2">
            <Switch
              checked={somenteProximos}
              onCheckedChange={setSomenteProximos}
              disabled={sendType !== 'REMINDER'}
            />
            <Label className="text-sm">Somente próximos do vencimento</Label>
          </div>
          {somenteProximos && sendType === 'REMINDER' && (
            <Select value={String(diasProximos)} onValueChange={v => setDiasProximos(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Hoje</SelectItem>
                <SelectItem value="1">1 dia</SelectItem>
                <SelectItem value="3">3 dias</SelectItem>
                <SelectItem value="5">5 dias</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="10">10 dias</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Company list */}
        {empresasPendentes.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {empresasPendentes.map(emp => {
                  const dias = getDiasAtraso(emp);
                  const nome = emp.client?.name || emp.client_name || emp.cnpj;
                  return (
                    <label
                      key={emp.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={empresasSelecionadas.has(emp.id)}
                        onCheckedChange={(checked) => handleSelecionarEmpresa(emp.id, !!checked)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{nome}</p>
                        <p className="text-xs text-muted-foreground font-mono">{emp.cnpj}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {emp.boletoStatus === 'LATE' && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-700 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Atrasado{dias != null ? ` ${dias}d` : ''}
                          </Badge>
                        )}
                        {(emp.boletoStatus === 'OPEN' || emp.boletoStatus === 'UNKNOWN' || emp.boletoStatus === 'PENDING') && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 text-[10px]">
                            <Clock className="h-3 w-3 mr-1" />
                            Em Aberto
                          </Badge>
                        )}
                        {emp.telefone ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {emp.telefone}
                          </span>
                        ) : (
                          <span className="text-xs text-destructive">Sem telefone</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Nenhuma empresa pendente encontrada para o filtro selecionado.
            </AlertDescription>
          </Alert>
        )}

        {/* Send button */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={sendType === 'REMINDER' ? handleEnviarLembretesSelecionados : handleEnviarBoletosSelecionados}
            disabled={enviando || empresasSelecionadas.size === 0}
            className="gap-2"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {getButtonLabel()}
          </Button>

          {resultado && resultado.erros > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setMostrarErrosUltimoEnvio(v => !v)}
            >
              Ver {resultado.erros} Erro(s)
            </Button>
          )}
        </div>

        {/* Current send results */}
        {resultado && (
          <Alert className={resultado.erros > 0 ? 'border-destructive/30' : 'border-green-300'}>
            <AlertDescription>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-700">✓ {resultado.sucessos}</Badge>
                {resultado.erros > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-700">✗ {resultado.erros}</Badge>}
                <Badge variant="outline">Total: {resultado.total}</Badge>
              </div>
              {resultado.resultados.filter(r => r.success).slice(0, 5).map((r, i) => (
                <div key={i} className="text-xs flex items-center gap-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>{r.empresa}</span>
                  {r.mensagemEnviada && <Badge variant="outline" className="text-[10px]">Mensagem</Badge>}
                  {r.pdfEnviado && <Badge variant="outline" className="text-[10px]">PDF</Badge>}
                  {r.lembreteEnviado && <Badge variant="outline" className="text-[10px]">Lembrete</Badge>}
                  {r.diasAtraso != null && r.diasAtraso > 0 && <Badge variant="outline" className="text-[10px] bg-red-500/10">{r.diasAtraso}d atraso</Badge>}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Footer info */}
        <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
          <p><strong>Competência:</strong> {competencia}</p>
          <p>Templates de mensagem configuráveis em <strong>Parâmetros</strong>.</p>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Templates ativos:</p>
            {templates?.filter(t => t.is_active).map(t => (
              <p key={t.id}>• <strong>{t.name}</strong> ({t.template_key})</p>
            ))}
          </div>
          <p>Boleto completo: usa template <code className="bg-muted px-1 rounded">before_due</code> ou <code className="bg-muted px-1 rounded">after_due</code> + PDF. Lembrete: <code className="bg-muted px-1 rounded">reminder</code> ou <code className="bg-muted px-1 rounded">reminder_today</code> (sem PDF).</p>
        </div>
      </CardContent>
    </Card>
  );
}
