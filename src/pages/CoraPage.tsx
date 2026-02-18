import { useState, useMemo, useEffect } from 'react';
import {
  useCoraEmpresas,
  useCreateCoraEmpresa,
  useUpdateCoraEmpresa,
  useDeleteCoraEmpresa,
  useCoraConfig,
  useUpsertCoraConfig,
  useCoraBoletos,
  useCoraMessageTemplates,
  useUpdateCoraMessageTemplate,
  useSyncEmpresasFromCRM,
  useSyncBoletos,
  CoraEmpresa,
  CoraEmpresaFormData,
  CoraBoleto,
} from '@/hooks/useCora';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Edit, Trash2, Loader2, Settings2, Building2, LayoutDashboard,
  RefreshCw, CheckCircle2, Clock, AlertTriangle, XCircle, HelpCircle,
  Mail, MessageSquare, Phone, TrendingUp, Calendar, Users, DollarSign,
  Send,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { EnvioBoletosPendentes } from '@/components/cora/EnvioBoletosPendentes';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCNPJ = (cnpj: string) => {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

type BoletoStatus = 'PAID' | 'OPEN' | 'LATE' | 'CANCELLED' | 'DRAFT' | 'UNKNOWN';

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PAID: { label: 'Pago', color: 'bg-green-500/15 text-green-700 border-green-300', icon: <CheckCircle2 className="h-4 w-4" /> },
  OPEN: { label: 'Em Aberto', color: 'bg-blue-500/15 text-blue-700 border-blue-300', icon: <Clock className="h-4 w-4" /> },
  LATE: { label: 'Atrasado', color: 'bg-red-500/15 text-red-700 border-red-300', icon: <AlertTriangle className="h-4 w-4" /> },
  CANCELLED: { label: 'Cancelado', color: 'bg-gray-500/15 text-gray-600 border-gray-300', icon: <XCircle className="h-4 w-4" /> },
  DRAFT: { label: 'Rascunho', color: 'bg-yellow-500/15 text-yellow-700 border-yellow-300', icon: <Clock className="h-4 w-4" /> },
  UNKNOWN: { label: 'Não Consultado', color: 'bg-muted text-muted-foreground border-border', icon: <HelpCircle className="h-4 w-4" /> },
};

function getEmpresaStatus(empresa: CoraEmpresa, boletos: CoraBoleto[]): { status: BoletoStatus; boleto: CoraBoleto | null } {
  const cnpjClean = empresa.cnpj.replace(/\D/g, '');
  const matched = boletos.filter(b => b.cnpj.replace(/\D/g, '') === cnpjClean);
  if (!matched.length) return { status: 'UNKNOWN', boleto: null };
  // Prefer non-cancelled, most recent
  const sorted = [...matched].sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));
  const boleto = sorted[0];
  const s = (boleto.status || '').toUpperCase();
  if (s === 'PAID') return { status: 'PAID', boleto };
  if (s === 'OPEN') return { status: 'OPEN', boleto };
  if (s === 'LATE') return { status: 'LATE', boleto };
  if (s === 'CANCELLED') return { status: 'CANCELLED', boleto };
  if (s === 'DRAFT' || s === 'RECURRENCE_DRAFT') return { status: 'DRAFT', boleto };
  return { status: 'UNKNOWN', boleto };
}

export function CoraPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cora - Boletos</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de empresas e boletos via API Cora
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="empresas" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="parametros" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Parâmetros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="empresas" className="mt-4">
          <EmpresasTab />
        </TabsContent>
        <TabsContent value="parametros" className="mt-4">
          <ParametrosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== DASHBOARD TAB =====================

function DashboardTab() {
  const now = new Date();
  const [competenciaAno, setCompetenciaAno] = useState(now.getFullYear());
  const [competenciaMes, setCompetenciaMes] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [envioFilter, setEnvioFilter] = useState<string>('ALL');

  const { data: empresas, isLoading: loadingEmpresas } = useCoraEmpresas();
  const { data: boletos, isLoading: loadingBoletos } = useCoraBoletos(competenciaAno, competenciaMes);
  const syncBoletos = useSyncBoletos();

  const activeEmpresas = useMemo(() => empresas?.filter(e => e.is_active) || [], [empresas]);

  const empresasComStatus = useMemo(() => {
    return activeEmpresas.map(emp => {
      const { status, boleto } = getEmpresaStatus(emp, boletos || []);
      return { ...emp, boletoStatus: status, boleto };
    });
  }, [activeEmpresas, boletos]);

  // Counts
  const counts = useMemo(() => {
    const c = { PAID: 0, OPEN: 0, LATE: 0, CANCELLED: 0, DRAFT: 0, UNKNOWN: 0 };
    empresasComStatus.forEach(e => { c[e.boletoStatus] = (c[e.boletoStatus] || 0) + 1; });
    return c;
  }, [empresasComStatus]);

  // Totals in BRL
  const totals = useMemo(() => {
    const t = { PAID: 0, OPEN: 0, LATE: 0, CANCELLED: 0, DRAFT: 0, UNKNOWN: 0, ALL: 0 };
    empresasComStatus.forEach(e => {
      const amount = e.boleto?.total_amount_cents ? e.boleto.total_amount_cents / 100 : e.valor_mensal || 0;
      t[e.boletoStatus] += amount;
      t.ALL += amount;
    });
    return t;
  }, [empresasComStatus]);

  // Envio stats
  const envioStats = useMemo(() => {
    const s = { EMAIL: 0, WHATSAPP: 0, COM_TELEFONE: 0 };
    activeEmpresas.forEach(e => {
      if (e.forma_envio === 'EMAIL') s.EMAIL++;
      if (e.forma_envio === 'WHATSAPP') s.WHATSAPP++;
      if (e.telefone) s.COM_TELEFONE++;
    });
    return s;
  }, [activeEmpresas]);

  const paymentRate = empresasComStatus.length > 0
    ? ((counts.PAID / empresasComStatus.length) * 100).toFixed(1)
    : '0.0';

  // Filters
  const filteredEmpresas = useMemo(() => {
    return empresasComStatus.filter(e => {
      if (statusFilter !== 'ALL' && e.boletoStatus !== statusFilter) return false;
      if (envioFilter !== 'ALL' && e.forma_envio !== envioFilter) return false;
      return true;
    });
  }, [empresasComStatus, statusFilter, envioFilter]);

  const isLoading = loadingEmpresas || loadingBoletos;

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Competência selector + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Competência:</span>
          <Select value={String(competenciaMes)} onValueChange={v => setCompetenciaMes(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(competenciaAno)} onValueChange={v => setCompetenciaAno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={syncBoletos.isPending}
            onClick={() => syncBoletos.mutate({ competenciaAno, competenciaMes })}
          >
            {syncBoletos.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Send className="h-4 w-4 mr-2" />
            Enviar Atrasados
          </Button>
        </div>
      </div>

      {/* Envio Seletivo */}
      <EnvioBoletosPendentes
        empresasComStatus={empresasComStatus}
        competenciaMes={competenciaMes}
        competenciaAno={competenciaAno}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard title="Pagos" count={counts.PAID} total={totals.PAID} icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} color="border-green-300" />
        <SummaryCard title="Em Aberto" count={counts.OPEN} total={totals.OPEN} icon={<Clock className="h-5 w-5 text-blue-600" />} color="border-blue-300" />
        <SummaryCard title="Atrasados" count={counts.LATE} total={totals.LATE} icon={<AlertTriangle className="h-5 w-5 text-red-600" />} color="border-red-300" />
        <SummaryCard title="Cancelados" count={counts.CANCELLED} total={totals.CANCELLED} icon={<XCircle className="h-5 w-5 text-gray-500" />} color="border-gray-300" />
        <SummaryCard title="Rascunhos" count={counts.DRAFT} total={totals.DRAFT} icon={<Clock className="h-5 w-5 text-yellow-600" />} color="border-yellow-300" />
        <SummaryCard title="Não Consultados" count={counts.UNKNOWN} total={totals.UNKNOWN} icon={<HelpCircle className="h-5 w-5 text-muted-foreground" />} color="border-border" />
      </div>

      {/* Statistics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Taxa Pagamento</p>
              <p className="text-lg font-bold">{paymentRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Competência</p>
              <p className="text-lg font-bold">{String(competenciaMes).padStart(2, '0')}/{competenciaAno}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Empresas</p>
              <p className="text-lg font-bold">{activeEmpresas.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Geral</p>
              <p className="text-lg font-bold">{formatCurrency(totals.ALL)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Envio stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-lg font-bold">{envioStats.EMAIL}</p>
              <p className="text-xs text-muted-foreground">
                {activeEmpresas.length > 0 ? ((envioStats.EMAIL / activeEmpresas.length) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="text-lg font-bold">{envioStats.WHATSAPP}</p>
              <p className="text-xs text-muted-foreground">
                {activeEmpresas.length > 0 ? ((envioStats.WHATSAPP / activeEmpresas.length) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Com Telefone</p>
              <p className="text-lg font-bold">{envioStats.COM_TELEFONE}</p>
              <p className="text-xs text-muted-foreground">
                {activeEmpresas.length > 0 ? ((envioStats.COM_TELEFONE / activeEmpresas.length) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Valor Total Mensal</p>
              <p className="text-lg font-bold">{formatCurrency(activeEmpresas.reduce((s, e) => s + (e.valor_mensal || 0), 0))}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os Status</SelectItem>
            <SelectItem value="PAID">Pagos</SelectItem>
            <SelectItem value="OPEN">Em Aberto</SelectItem>
            <SelectItem value="LATE">Atrasados</SelectItem>
            <SelectItem value="CANCELLED">Cancelados</SelectItem>
            <SelectItem value="DRAFT">Rascunhos</SelectItem>
            <SelectItem value="UNKNOWN">Não Consultados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={envioFilter} onValueChange={setEnvioFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Forma de Envio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas Formas</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground flex items-center ml-auto">
          {filteredEmpresas.length} empresa{filteredEmpresas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Payment progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso de Pagamento</span>
            <span className="text-sm text-muted-foreground">{counts.PAID} / {empresasComStatus.length} empresas</span>
          </div>
          <Progress value={empresasComStatus.length > 0 ? (counts.PAID / empresasComStatus.length) * 100 : 0} className="h-3" />
        </CardContent>
      </Card>

      {/* Company cards */}
      {filteredEmpresas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma empresa encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEmpresas.map(emp => (
            <CompanyCard key={emp.id} empresa={emp} competenciaMes={competenciaMes} competenciaAno={competenciaAno} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, count, total, icon, color }: {
  title: string; count: number; total: number; icon: React.ReactNode; color: string;
}) {
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{title}</span>
          {icon}
        </div>
        <p className="text-xl font-bold">{count}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(total)}</p>
      </CardContent>
    </Card>
  );
}

function CompanyCard({ empresa, competenciaMes, competenciaAno }: {
  empresa: CoraEmpresa & { boletoStatus: BoletoStatus; boleto: CoraBoleto | null };
  competenciaMes: number;
  competenciaAno: number;
}) {
  const statusInfo = STATUS_MAP[empresa.boletoStatus] || STATUS_MAP.UNKNOWN;
  const amount = empresa.boleto?.total_amount_cents
    ? empresa.boleto.total_amount_cents / 100
    : empresa.valor_mensal || 0;

  const dueDate = empresa.boleto?.due_date
    ? new Date(empresa.boleto.due_date + 'T00:00:00').toLocaleDateString('pt-BR')
    : `${String(empresa.dia_vencimento).padStart(2, '0')}/${String(competenciaMes).padStart(2, '0')}/${competenciaAno}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{empresa.client?.name || empresa.client_name || '-'}</p>
            <p className="text-xs font-mono text-muted-foreground">{formatCNPJ(empresa.cnpj)}</p>
          </div>
          <Badge className={`${statusInfo.color} gap-1 shrink-0 ml-2`} variant="outline">
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="font-semibold">{formatCurrency(amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vencimento</p>
            <p className="font-medium">{dueDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Competência</p>
            <p className="font-medium">{String(competenciaMes).padStart(2, '0')}/{competenciaAno}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Envio</p>
            <Badge variant="outline" className="mt-0.5">{empresa.forma_envio}</Badge>
          </div>
        </div>

        {empresa.boleto?.synced_at && (
          <p className="text-xs text-muted-foreground">
            Atualizado: {new Date(empresa.boleto.synced_at).toLocaleString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ===================== EMPRESAS TAB =====================

function EmpresasTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<CoraEmpresa | null>(null);
  const { data: empresas, isLoading } = useCoraEmpresas();
  const { data: clients } = useClients();
  const createEmpresa = useCreateCoraEmpresa();
  const updateEmpresa = useUpdateCoraEmpresa();
  const deleteEmpresa = useDeleteCoraEmpresa();
  const syncFromCRM = useSyncEmpresasFromCRM();

  const [formData, setFormData] = useState<CoraEmpresaFormData>({
    client_id: null,
    client_name: '',
    cnpj: '',
    telefone: '',
    email: '',
    dia_vencimento: 15,
    valor_mensal: 0,
    forma_envio: 'EMAIL',
    observacoes: '',
  });
  const [clientInputMode, setClientInputMode] = useState<'select' | 'free'>('select');

  const openNew = () => {
    setEditing(null);
    setClientInputMode('select');
    setFormData({
      client_id: null,
      client_name: '',
      cnpj: '',
      telefone: '',
      email: '',
      dia_vencimento: 15,
      valor_mensal: 0,
      forma_envio: 'EMAIL',
      observacoes: '',
    });
    setIsOpen(true);
  };

  const openEdit = (emp: CoraEmpresa) => {
    setEditing(emp);
    setClientInputMode(emp.client_id ? 'select' : 'free');
    setFormData({
      client_id: emp.client_id,
      client_name: emp.client_name || emp.client?.name || '',
      cnpj: emp.cnpj,
      telefone: emp.telefone || '',
      email: emp.email || '',
      dia_vencimento: emp.dia_vencimento,
      valor_mensal: emp.valor_mensal,
      forma_envio: emp.forma_envio || 'EMAIL',
      observacoes: emp.observacoes || '',
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = {
      ...formData,
      client_id: formData.client_id || null,
      client_name: formData.client_name || null,
      observacoes: formData.observacoes || null,
    };
    if (editing) {
      await updateEmpresa.mutateAsync({ id: editing.id, data: sanitized });
    } else {
      await createEmpresa.mutateAsync(sanitized as CoraEmpresaFormData);
    }
    setIsOpen(false);
  };

  const totalMensal = empresas?.filter(e => e.is_active).reduce((s, e) => s + (e.valor_mensal || 0), 0) || 0;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <strong>Total Mensal (ativas):</strong> {formatCurrency(totalMensal)} · {empresas?.filter(e => e.is_active).length || 0} empresas
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncFromCRM.mutate()} disabled={syncFromCRM.isPending}>
            {syncFromCRM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar do CRM
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !empresas?.length ? (
        <div className="text-center py-8 text-muted-foreground">Nenhuma empresa cadastrada</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((emp) => (
                  <TableRow key={emp.id} className={!emp.is_active ? 'opacity-60 bg-muted/30' : ''}>
                    <TableCell className="font-medium">
                      {emp.client?.name || emp.client_name || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{emp.cnpj}</TableCell>
                    <TableCell>{formatCurrency(emp.valor_mensal)}</TableCell>
                    <TableCell>Dia {emp.dia_vencimento}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{emp.forma_envio}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.is_active ? 'default' : 'secondary'}>
                        {emp.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEmpresa.mutate(emp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" variant={clientInputMode === 'select' ? 'default' : 'outline'} size="sm"
                  onClick={() => { setClientInputMode('select'); setFormData({ ...formData, client_name: '', client_id: null }); }}>
                  Selecionar cadastrado
                </Button>
                <Button type="button" variant={clientInputMode === 'free' ? 'default' : 'outline'} size="sm"
                  onClick={() => { setClientInputMode('free'); setFormData({ ...formData, client_id: null }); }}>
                  Nome livre
                </Button>
              </div>
              {clientInputMode === 'select' ? (
                <Select value={formData.client_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, client_id: v === 'none' ? null : v, client_name: null })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formData.client_name || ''}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value, client_id: null })}
                  placeholder="Nome do cliente" />
              )}
            </div>

            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Mensal</Label>
                <Input type="number" value={formData.valor_mensal || ''}
                  onChange={(e) => setFormData({ ...formData, valor_mensal: e.target.value ? Number(e.target.value) : 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Dia do Vencimento</Label>
                <Input type="number" min={1} max={31} value={formData.dia_vencimento || 15}
                  onChange={(e) => setFormData({ ...formData, dia_vencimento: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formData.telefone || ''} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Forma de Envio</Label>
              <Select value={formData.forma_envio || 'EMAIL'} onValueChange={(v) => setFormData({ ...formData, forma_envio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes || ''} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createEmpresa.isPending || updateEmpresa.isPending}>
                {createEmpresa.isPending || updateEmpresa.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===================== PARÂMETROS TAB =====================

function ParametrosTab() {
  const { data: configs, isLoading } = useCoraConfig();
  const upsertConfig = useUpsertCoraConfig();
  const { data: templates, isLoading: loadingTemplates } = useCoraMessageTemplates();
  const updateTemplate = useUpdateCoraMessageTemplate();

  const [apiConfig, setApiConfig] = useState({
    client_id: '',
    base_url: 'https://api.cora.com.br',
    matls_url: 'https://matls-clients.api.cora.com.br',
    backend_token_url: '',
  });

  const [whatsappConfig, setWhatsappConfig] = useState({
    api_url: '',
    token: '',
  });

  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    if (!configs || configLoaded) return;
    const api = configs.find(c => c.chave === 'cora_api');
    const wpp = configs.find(c => c.chave === 'whatsapp');
    if (api?.valor) {
      const v = api.valor as any;
      setApiConfig({
        client_id: v.client_id || '',
        base_url: v.base_url || 'https://api.cora.com.br',
        matls_url: v.matls_url || 'https://matls-clients.api.cora.com.br',
        backend_token_url: v.backend_token_url || '',
      });
    }
    if (wpp?.valor) {
      const v = wpp.valor as any;
      setWhatsappConfig({ api_url: v.api_url || '', token: v.token || '' });
    }
    setConfigLoaded(true);
  }, [configs, configLoaded]);

  const saveApiConfig = () => { upsertConfig.mutate({ chave: 'cora_api', valor: apiConfig }); };
  const saveWhatsappConfig = () => { upsertConfig.mutate({ chave: 'whatsapp', valor: whatsappConfig }); };

  const handleStartEdit = (template: any) => {
    setEditingTemplate(template.id);
    setEditBody(template.message_body);
  };

  const handleSaveTemplate = (id: string) => {
    updateTemplate.mutate({ id, message_body: editBody });
    setEditingTemplate(null);
  };

  const handleToggleActive = (template: any) => {
    updateTemplate.mutate({ id: template.id, message_body: template.message_body, is_active: !template.is_active });
  };

  if (isLoading || loadingTemplates) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
    before_due: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    after_due: <AlertTriangle className="h-5 w-5 text-red-600" />,
    reminder: <Clock className="h-5 w-5 text-blue-600" />,
    reminder_today: <Calendar className="h-5 w-5 text-yellow-600" />,
  };

  return (
    <div className="space-y-6">
      {/* Templates de Mensagem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Templates de Mensagem
          </CardTitle>
          <CardDescription>
            Configure as mensagens enviadas para cada cenário. Use as variáveis: <code className="bg-muted px-1 rounded">{'{{nome}}'}</code>, <code className="bg-muted px-1 rounded">{'{{competencia}}'}</code>, <code className="bg-muted px-1 rounded">{'{{vencimento}}'}</code>, <code className="bg-muted px-1 rounded">{'{{valor}}'}</code>, <code className="bg-muted px-1 rounded">{'{{dias_atraso}}'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates?.map(template => (
            <Card key={template.id} className={`border ${!template.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {TEMPLATE_ICONS[template.template_key] || <MessageSquare className="h-5 w-5" />}
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={template.is_active ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => handleToggleActive(template)}>
                      {template.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {editingTemplate === template.id ? (
                      <Button size="sm" onClick={() => handleSaveTemplate(template.id)} disabled={updateTemplate.isPending}>
                        Salvar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleStartEdit(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {editingTemplate === template.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={4}
                      className="text-sm"
                    />
                    <Button size="sm" variant="ghost" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">
                    {template.message_body}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* API & WhatsApp configs */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API Cora</CardTitle>
            <CardDescription>Configurações de conexão com a API Cora (mTLS).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID Cora</Label>
              <Input value={apiConfig.client_id} onChange={(e) => setApiConfig({ ...apiConfig, client_id: e.target.value })} placeholder="int-3udMdndv53r4OZLtakIhF3" />
            </div>
            <div className="space-y-2">
              <Label>Base URL (API pública)</Label>
              <Input value={apiConfig.base_url} onChange={(e) => setApiConfig({ ...apiConfig, base_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>mTLS URL (autenticação)</Label>
              <Input value={apiConfig.matls_url} onChange={(e) => setApiConfig({ ...apiConfig, matls_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>URL do Backend (get-token)</Label>
              <Input value={apiConfig.backend_token_url} onChange={(e) => setApiConfig({ ...apiConfig, backend_token_url: e.target.value })} placeholder="https://sua-vps.com/api/cora/get-token" />
              <p className="text-xs text-muted-foreground">URL do seu backend Node.js (VPS/EasyPanel) que possui os certificados e faz mTLS.</p>
            </div>
            <Button onClick={saveApiConfig} disabled={upsertConfig.isPending}>Salvar Configurações API</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp</CardTitle>
            <CardDescription>Configurações para envio de boletos via WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL da API WhatsApp</Label>
              <Input value={whatsappConfig.api_url} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, api_url: e.target.value })} placeholder="https://api.wascript.com.br/..." />
            </div>
            <div className="space-y-2">
              <Label>Token WhatsApp</Label>
              <Input type="password" value={whatsappConfig.token} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, token: e.target.value })} />
            </div>
            <Button onClick={saveWhatsappConfig} disabled={upsertConfig.isPending}>Salvar Configurações WhatsApp</Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Arquitetura da Integração</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>1. Token:</strong> O backend (VPS com certificados) autentica via mTLS em <code>matls-clients.api.cora.com.br/token</code> e retorna o access_token.</p>
            <p><strong>2. Busca:</strong> Com o token, busca boletos em <code>/v2/invoices?search=CNPJ&start=...&end=...</code>.</p>
            <p><strong>3. Status:</strong> OPEN, PAID, LATE, CANCELLED, DRAFT, IN_PAYMENT.</p>
            <p><strong>4. Cache:</strong> Boletos são armazenados na tabela <code>cora_boletos</code> para consulta rápida sem chamar a API toda vez.</p>
            <p><strong>5. Envio:</strong> Busca boleto por CNPJ + competência, baixa PDF, envia via WhatsApp/Email. Registra em <code>cora_envios</code>.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
