import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, subMonths, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, TrendingDown, Users, Target, DollarSign,
  BarChart3, ArrowUpRight, ArrowDownRight, Clock, Megaphone,
  Plus, Loader2, Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { AcquisitionChannel } from '@/types/crm';

const CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  whatsapp: 'WhatsApp',
  social_media: 'Mídias Sociais',
  website_form: 'Formulário/Site',
  referral: 'Indicação',
  direct_prospecting: 'Prospecção Direta',
  google_ads: 'Google Ads',
  events: 'Eventos/Networking',
  other: 'Outros',
};

const CHANNEL_COLORS: Record<AcquisitionChannel, string> = {
  whatsapp: '#25D366',
  social_media: '#E1306C',
  website_form: '#3B82F6',
  referral: '#F59E0B',
  direct_prospecting: '#8B5CF6',
  google_ads: '#EA4335',
  events: '#06B6D4',
  other: '#6B7280',
};

const MARKETING_CHANNELS: AcquisitionChannel[] = ['whatsapp', 'social_media', 'website_form', 'google_ads', 'events', 'other'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function CommercialDashboard() {
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [investmentMonth, setInvestmentMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [investmentAmount, setInvestmentAmount] = useState('');
  const queryClient = useQueryClient();

  // Fetch leads
  const { data: leads, isLoading: loadingLeads } = useQuery({
    queryKey: ['leads-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients with acquisition source
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['clients-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, acquisition_source, created_at, is_active').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch contracts for revenue
  const { data: contracts } = useQuery({
    queryKey: ['contracts-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('id, client_id, monthly_value, status, created_at');
      if (error) throw error;
      return data;
    },
  });

  // Fetch marketing investments
  const { data: investments } = useQuery({
    queryKey: ['marketing-investments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('marketing_investments').select('*').order('month', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Save investment mutation
  const saveInvestment = useMutation({
    mutationFn: async ({ month, total_amount }: { month: string; total_amount: number }) => {
      const { error } = await supabase.from('marketing_investments').upsert(
        { month, total_amount },
        { onConflict: 'month' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-investments'] });
      setInvestmentDialogOpen(false);
      setInvestmentAmount('');
    },
  });

  // ========================
  // KPI CALCULATIONS
  // ========================
  const kpis = useMemo(() => {
    const allLeads = leads || [];
    const allClients = clients || [];
    const allContracts = contracts || [];
    const allInvestments = investments || [];

    const now = new Date();
    const thisMonth = format(now, 'yyyy-MM');
    const lastMonth = format(subMonths(now, 1), 'yyyy-MM');

    // Leads this month vs last month
    const leadsThisMonth = allLeads.filter(l => l.created_at?.startsWith(thisMonth));
    const leadsLastMonth = allLeads.filter(l => l.created_at?.startsWith(lastMonth));

    // Won leads (conversions)
    const wonLeads = allLeads.filter(l => l.status === 'won');
    const lostLeads = allLeads.filter(l => l.status === 'lost');
    const activeLeads = allLeads.filter(l => !['won', 'lost'].includes(l.status));

    // Conversion rate
    const totalDecided = wonLeads.length + lostLeads.length;
    const conversionRate = totalDecided > 0 ? (wonLeads.length / totalDecided) * 100 : 0;

    // Average ticket (from won leads or active contracts)
    const avgTicket = wonLeads.length > 0
      ? wonLeads.reduce((s, l) => s + (l.expected_value || 0), 0) / wonLeads.length
      : 0;

    // Total monthly revenue from active contracts
    const activeContractRevenue = allContracts
      .filter(c => c.status === 'active')
      .reduce((s, c) => s + (c.monthly_value || 0), 0);

    // Total marketing investment (all time)
    const totalInvestment = allInvestments.reduce((s, i) => s + (i.total_amount || 0), 0);

    // Current month investment
    const currentMonthInvestment = allInvestments.find(i => i.month?.startsWith(thisMonth))?.total_amount || 0;

    // ROI: revenue from converted leads / investment
    const convertedClientIds = wonLeads.map(l => l.converted_client_id).filter(Boolean);
    const revenueFromConverted = allContracts
      .filter(c => c.status === 'active' && convertedClientIds.includes(c.client_id))
      .reduce((s, c) => s + (c.monthly_value || 0), 0);
    const roi = totalInvestment > 0 ? ((revenueFromConverted * 12 - totalInvestment) / totalInvestment) * 100 : 0;

    // CAC (Cost of Acquisition)
    const marketingLeadsConverted = wonLeads.filter(l => {
      const ch = l.acquisition_channel;
      return ch && MARKETING_CHANNELS.includes(ch as AcquisitionChannel);
    });
    const cac = marketingLeadsConverted.length > 0 ? totalInvestment / marketingLeadsConverted.length : 0;

    // Average cycle time (days from creation to won)
    const cycleTimes = wonLeads.map(l => {
      const created = parseISO(l.created_at);
      const updated = parseISO(l.updated_at);
      return differenceInDays(updated, created);
    }).filter(d => d >= 0);
    const avgCycleTime = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((s, d) => s + d, 0) / cycleTimes.length) : 0;

    // By channel
    const byChannel: Record<string, { leads: number; won: number; lost: number; revenue: number }> = {};
    allLeads.forEach(l => {
      const ch = l.acquisition_channel || l.source || 'Não definido';
      if (!byChannel[ch]) byChannel[ch] = { leads: 0, won: 0, lost: 0, revenue: 0 };
      byChannel[ch].leads++;
      if (l.status === 'won') {
        byChannel[ch].won++;
        byChannel[ch].revenue += l.expected_value || 0;
      }
      if (l.status === 'lost') byChannel[ch].lost++;
    });

    // Clients by acquisition source
    const clientsBySource: Record<string, number> = {};
    allClients.forEach(c => {
      const src = c.acquisition_source || 'Não definido';
      clientsBySource[src] = (clientsBySource[src] || 0) + 1;
    });

    // Funnel conversion rates
    const funnelStages = ['prospecting', 'contact', 'proposal', 'negotiation', 'won'] as const;
    const funnelData = funnelStages.map(stage => ({
      stage,
      label: stage === 'prospecting' ? 'Prospecção' :
             stage === 'contact' ? 'Contato' :
             stage === 'proposal' ? 'Proposta' :
             stage === 'negotiation' ? 'Negociação' : 'Ganho',
      count: allLeads.filter(l => {
        const idx = funnelStages.indexOf(l.status as any);
        const stageIdx = funnelStages.indexOf(stage);
        return idx >= stageIdx || l.status === 'lost';
      }).length,
      current: allLeads.filter(l => l.status === stage).length,
    }));

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const key = format(m, 'yyyy-MM');
      const monthLeads = allLeads.filter(l => l.created_at?.startsWith(key));
      const monthWon = allLeads.filter(l => l.status === 'won' && l.updated_at?.startsWith(key));
      const monthInv = allInvestments.find(inv => inv.month?.startsWith(key));
      monthlyTrend.push({
        month: format(m, 'MMM/yy', { locale: ptBR }),
        leads: monthLeads.length,
        conversions: monthWon.length,
        investment: monthInv?.total_amount || 0,
      });
    }

    return {
      totalLeads: allLeads.length,
      activeLeads: activeLeads.length,
      leadsThisMonth: leadsThisMonth.length,
      leadsLastMonth: leadsLastMonth.length,
      wonLeads: wonLeads.length,
      lostLeads: lostLeads.length,
      conversionRate,
      avgTicket,
      activeContractRevenue,
      totalInvestment,
      currentMonthInvestment,
      roi,
      cac,
      avgCycleTime,
      byChannel,
      clientsBySource,
      funnelData,
      monthlyTrend,
    };
  }, [leads, clients, contracts, investments]);

  // Chart data
  const channelChartData = useMemo(() => {
    return Object.entries(kpis.byChannel).map(([channel, data]) => ({
      name: CHANNEL_LABELS[channel as AcquisitionChannel] || channel,
      leads: data.leads,
      conversoes: data.won,
      taxa: data.leads > 0 ? Math.round((data.won / data.leads) * 100) : 0,
      color: CHANNEL_COLORS[channel as AcquisitionChannel] || '#6B7280',
    }));
  }, [kpis.byChannel]);

  const clientSourceData = useMemo(() => {
    return Object.entries(kpis.clientsBySource)
      .map(([source, count]) => ({
        name: CHANNEL_LABELS[source as AcquisitionChannel] || source,
        value: count,
        color: CHANNEL_COLORS[source as AcquisitionChannel] || '#6B7280',
      }))
      .sort((a, b) => b.value - a.value);
  }, [kpis.clientsBySource]);

  const isLoading = loadingLeads || loadingClients;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const leadsGrowth = kpis.leadsLastMonth > 0
    ? ((kpis.leadsThisMonth - kpis.leadsLastMonth) / kpis.leadsLastMonth) * 100
    : kpis.leadsThisMonth > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Leads Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.activeLeads}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {leadsGrowth >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={leadsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(leadsGrowth).toFixed(0)}%
              </span>
              <span>vs mês anterior ({kpis.leadsThisMonth} este mês)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{kpis.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.wonLeads} ganhos / {kpis.wonLeads + kpis.lostLeads} decididos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.avgTicket)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita ativa: {formatCurrency(kpis.activeContractRevenue)}/mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Ciclo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgCycleTime} dias</div>
            <p className="text-xs text-muted-foreground mt-1">
              Da prospecção ao fechamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 - Marketing */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Investimento Mensal</CardTitle>
            <div className="flex items-center gap-1">
              <Megaphone className="h-4 w-4 text-primary" />
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setInvestmentDialogOpen(true)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.currentMonthInvestment)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total acumulado: {formatCurrency(kpis.totalInvestment)}
            </p>
          </CardContent>
        </Card>

        <Card className={kpis.roi >= 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">ROI Marketing</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {kpis.roi.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Retorno anualizado sobre investimento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">CAC</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.cac)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Custo de aquisição por cliente (marketing)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpis.funnelData.map((stage, i) => {
                const maxCount = Math.max(...kpis.funnelData.map(s => s.count), 1);
                const width = Math.max((stage.count / maxCount) * 100, 8);
                const rate = i > 0 && kpis.funnelData[i - 1].count > 0
                  ? Math.round((stage.count / kpis.funnelData[i - 1].count) * 100)
                  : 100;
                return (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{stage.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{stage.current} ativos</Badge>
                        {i > 0 && <span className="text-xs text-muted-foreground">{rate}%</span>}
                      </div>
                    </div>
                    <div className="h-6 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-md flex items-center justify-center text-xs text-primary-foreground font-medium transition-all"
                        style={{ width: `${width}%` }}
                      >
                        {stage.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Leads by Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            {channelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={channelChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number, name: string) => [value, name === 'leads' ? 'Leads' : 'Conversões']} />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="conversoes" fill="hsl(var(--primary)/0.5)" name="Conversões" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhum lead cadastrado com canal definido
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clients by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {clientSourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={clientSourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {clientSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhum cliente com origem definida
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendência Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={kpis.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" name="Leads" strokeWidth={2} />
                <Line type="monotone" dataKey="conversions" stroke="#22C55E" name="Conversões" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Canal</th>
                  <th className="text-right py-2 px-3 font-medium">Leads</th>
                  <th className="text-right py-2 px-3 font-medium">Ganhos</th>
                  <th className="text-right py-2 px-3 font-medium">Perdidos</th>
                  <th className="text-right py-2 px-3 font-medium">Taxa Conv.</th>
                  <th className="text-right py-2 px-3 font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(kpis.byChannel).map(([channel, data]) => {
                  const decided = data.won + data.lost;
                  const rate = decided > 0 ? (data.won / decided * 100).toFixed(1) : '–';
                  return (
                    <tr key={channel} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 px-3 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHANNEL_COLORS[channel as AcquisitionChannel] || '#6B7280' }}
                        />
                        {CHANNEL_LABELS[channel as AcquisitionChannel] || channel}
                      </td>
                      <td className="text-right py-2 px-3">{data.leads}</td>
                      <td className="text-right py-2 px-3 text-green-600">{data.won}</td>
                      <td className="text-right py-2 px-3 text-red-600">{data.lost}</td>
                      <td className="text-right py-2 px-3 font-medium">{rate}%</td>
                      <td className="text-right py-2 px-3">{formatCurrency(data.revenue)}</td>
                    </tr>
                  );
                })}
                {Object.keys(kpis.byChannel).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhum dado disponível. Cadastre leads com canal de aquisição.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Investment Dialog */}
      <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Investimento em Marketing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={investmentMonth.substring(0, 7)}
                onChange={(e) => setInvestmentMonth(e.target.value + '-01')}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Total Investido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestmentDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveInvestment.mutate({ month: investmentMonth, total_amount: Number(investmentAmount) })}
              disabled={!investmentAmount || saveInvestment.isPending}
            >
              {saveInvestment.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
