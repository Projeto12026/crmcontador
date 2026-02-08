import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BarChart3, TrendingUp, Users, DollarSign, Clock, Target, Loader2 } from 'lucide-react';
import { usePricingProposals } from '@/hooks/usePricing';
import { useMemo } from 'react';

export function PricingIndicators() {
  const { data: proposals, isLoading } = usePricingProposals();

  const indicators = useMemo(() => {
    if (!proposals || proposals.length === 0) return null;

    const approved = proposals.filter(p => p.status === 'approved');
    const allProposals = proposals;

    const totalRevenue = approved.reduce((sum, p) => sum + p.total_monthly_value, 0);
    const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;
    const conversionRate = allProposals.length > 0
      ? (approved.length / allProposals.length) * 100
      : 0;

    // Revenue by regime
    const byRegime: Record<string, { count: number; total: number }> = {};
    approved.forEach(p => {
      const key = p.tax_regime || 'indefinido';
      if (!byRegime[key]) byRegime[key] = { count: 0, total: 0 };
      byRegime[key].count++;
      byRegime[key].total += p.total_monthly_value;
    });

    // Avg by number of employees
    const withEmployees = approved.filter(p => p.num_employees > 0);
    const avgPerEmployee = withEmployees.length > 0
      ? withEmployees.reduce((sum, p) => sum + p.total_monthly_value / Math.max(p.num_employees, 1), 0) / withEmployees.length
      : 0;

    // Most common markup
    const avgMarkup = approved.length > 0
      ? approved.reduce((sum, p) => sum + p.markup_percentage, 0) / approved.length
      : 0;

    // Avg hourly cost
    const avgHourlyCost = approved.length > 0
      ? approved.reduce((sum, p) => sum + p.hourly_cost, 0) / approved.length
      : 0;

    return {
      totalRevenue,
      avgTicket,
      conversionRate,
      approvedCount: approved.length,
      totalProposals: allProposals.length,
      byRegime,
      avgPerEmployee,
      avgMarkup,
      avgHourlyCost,
    };
  }, [proposals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!indicators) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma proposta aprovada ainda.</p>
          <p className="text-sm text-muted-foreground">Os indicadores aparecerão quando houver propostas com status "Aprovada".</p>
        </CardContent>
      </Card>
    );
  }

  const regimeLabels: Record<string, string> = {
    mei: 'MEI',
    simples: 'Simples Nacional',
    lucro_presumido: 'Lucro Presumido',
    lucro_real: 'Lucro Real',
    indefinido: 'Indefinido',
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          title="Receita Recorrente"
          value={`R$ ${indicators.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle={`${indicators.approvedCount} contratos ativos`}
        />
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          title="Ticket Médio"
          value={`R$ ${indicators.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="por contrato aprovado"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="Taxa de Conversão"
          value={`${indicators.conversionRate.toFixed(1)}%`}
          subtitle={`${indicators.approvedCount} de ${indicators.totalProposals} propostas`}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          title="Honorário/Funcionário"
          value={`R$ ${indicators.avgPerEmployee.toFixed(2)}`}
          subtitle="média por funcionário do cliente"
        />
      </div>

      {/* Details */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Regime */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Receita por Regime Tributário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(indicators.byRegime)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([regime, data]) => {
                const pct = (data.total / indicators.totalRevenue) * 100;
                return (
                  <div key={regime} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{regimeLabels[regime] || regime}</span>
                      <span className="font-medium">R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({data.count})</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* Averages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Médias do Escritório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Custo/Hora Médio
              </span>
              <span className="font-bold">R$ {indicators.avgHourlyCost.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Markup Médio</span>
              <span className="font-bold">{indicators.avgMarkup.toFixed(1)}%</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor/Hora Vendido</span>
              <span className="font-bold text-primary">
                R$ {(indicators.avgHourlyCost * (1 + indicators.avgMarkup / 100)).toFixed(2)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Propostas Pendentes</span>
              <Badge variant="outline">{indicators.totalProposals - indicators.approvedCount}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, title, value, subtitle }: { icon: React.ReactNode; title: string; value: string; subtitle: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{title}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
