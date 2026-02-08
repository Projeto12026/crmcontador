import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Save, Loader2, Clock, DollarSign, Zap } from 'lucide-react';
import { useServiceCatalog, useCreatePricingProposal, PricingServiceCatalog } from '@/hooks/usePricing';
import { useClients } from '@/hooks/useClients';
import { PricingCostConfig, CostConfig, getDefaultCostConfig } from './PricingCostConfig';
import { ClientDiagnostic, DiagnosticData, computeComplexityScore, getDefaultDiagnostic } from './ClientDiagnostic';
import { ClientProfitability } from './ClientProfitability';

const DEPARTMENTS: Record<string, string> = {
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  pessoal: 'Pessoal',
  societario: 'Societário',
  consultoria: 'Consultoria',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  recurring: 'Recorrente',
  annual: 'Anual',
  one_time: 'Pontual',
};

interface SelectedService {
  catalog_id: string;
  name: string;
  department: string;
  hours: number;
  selected: boolean;
  serviceType: string;
}

export function PricingSimulator() {
  const { data: catalog } = useServiceCatalog();
  const { data: clients } = useClients();
  const createProposal = useCreatePricingProposal();

  // Config
  const [costConfig, setCostConfig] = useState<CostConfig>(getDefaultCostConfig);

  // Diagnostic
  const [diagnostic, setDiagnostic] = useState<DiagnosticData>(getDefaultDiagnostic);

  // Services
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [notes, setNotes] = useState('');

  // Initialize services from catalog
  if (catalog && !initialized) {
    setSelectedServices(
      catalog.map(s => ({
        catalog_id: s.id,
        name: s.name,
        department: s.department,
        hours: s.default_hours_per_month,
        selected: false,
        serviceType: (s as any).service_type || 'recurring',
      }))
    );
    setInitialized(true);
  }

  const totalMarkup = costConfig.markup.taxes + costConfig.markup.civilLiability + costConfig.markup.pdd + costConfig.markup.interest + costConfig.markup.profit;

  // Get hourly rate per department
  const getDeptHourlyRate = (dept: string): number => {
    const deptConfig = costConfig.departments[dept];
    if (!deptConfig) return 100;
    return deptConfig.costPerHour * (1 + totalMarkup / 100);
  };

  const toggleService = (index: number) => {
    setSelectedServices(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s));
  };

  const updateHours = (index: number, hours: number) => {
    setSelectedServices(prev => prev.map((s, i) => i === index ? { ...s, hours } : s));
  };

  const activeServices = selectedServices.filter(s => s.selected);
  const recurringServices = activeServices.filter(s => s.serviceType === 'recurring');
  const extraServices = activeServices.filter(s => s.serviceType !== 'recurring');

  const totalRecurringHours = recurringServices.reduce((sum, s) => sum + s.hours, 0);
  const totalRecurringValue = recurringServices.reduce((sum, s) => sum + s.hours * getDeptHourlyRate(s.department), 0);
  const totalExtraValue = extraServices.reduce((sum, s) => sum + s.hours * getDeptHourlyRate(s.department), 0);

  const complexityScore = computeComplexityScore(diagnostic);
  const adjustedRecurringTotal = totalRecurringValue * complexityScore;
  const adjustedExtraTotal = totalExtraValue * complexityScore;
  const grandTotal = adjustedRecurringTotal + adjustedExtraTotal;

  const byDepartment = useMemo(() => {
    const grouped: Record<string, { hours: number; value: number }> = {};
    activeServices.forEach(s => {
      if (!grouped[s.department]) grouped[s.department] = { hours: 0, value: 0 };
      grouped[s.department].hours += s.hours;
      grouped[s.department].value += s.hours * getDeptHourlyRate(s.department);
    });
    return grouped;
  }, [activeServices, costConfig, totalMarkup]);

  const handleSave = () => {
    const items = activeServices.map(s => ({
      service_catalog_id: s.catalog_id,
      service_name: s.name,
      department: s.department,
      hours_per_month: s.hours,
      hourly_rate: getDeptHourlyRate(s.department),
      monthly_value: s.hours * getDeptHourlyRate(s.department) * complexityScore,
    }));

    const selectedClient = clients?.find(c => c.id === diagnostic.clientId);

    createProposal.mutate({
      client_id: diagnostic.clientId || null,
      client_name: diagnostic.clientId ? selectedClient?.name || '' : diagnostic.clientName,
      tax_regime: diagnostic.taxRegime,
      num_employees: diagnostic.numEmployees,
      num_monthly_invoices: diagnostic.numInvoices,
      monthly_revenue: diagnostic.monthlyRevenue,
      hourly_cost: Object.values(costConfig.departments).reduce((sum, d) => sum + d.costPerHour, 0) / Object.keys(costConfig.departments).length,
      markup_percentage: totalMarkup,
      notes,
      items,
    });
  };

  const groupedCatalog = selectedServices.reduce<Record<string, { index: number; service: SelectedService }[]>>(
    (acc, s, i) => {
      (acc[s.department] = acc[s.department] || []).push({ index: i, service: s });
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {/* Step 1: Configuração de Custos */}
      <Tabs defaultValue="diagnostic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config" className="gap-2">
            <Calculator className="h-4 w-4" />
            1. Custos & Markup
          </TabsTrigger>
          <TabsTrigger value="diagnostic" className="gap-2">
            <Zap className="h-4 w-4" />
            2. Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Clock className="h-4 w-4" />
            3. Serviços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <PricingCostConfig config={costConfig} onChange={setCostConfig} />
        </TabsContent>

        <TabsContent value="diagnostic" className="space-y-4">
          <ClientDiagnostic data={diagnostic} onChange={setDiagnostic} clients={clients} />
          <ClientProfitability
            clientId={diagnostic.clientId}
            clientName={diagnostic.clientName}
            calculatedIdealPrice={grandTotal}
            hasServicesSelected={activeServices.length > 0}
          />
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Ficha Técnica de Serviços
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(DEPARTMENTS).map(([key, label]) => {
                const items = groupedCatalog[key];
                if (!items || items.length === 0) return null;
                const deptRate = getDeptHourlyRate(key);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">{label}</h4>
                      <Badge variant="outline" className="text-xs">
                        R$ {deptRate.toFixed(0)}/h
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {items.map(({ index, service }) => (
                        <div key={index} className="flex items-center gap-3 rounded-lg border p-2">
                          <Checkbox
                            checked={service.selected}
                            onCheckedChange={() => toggleService(index)}
                          />
                          <span className="flex-1 text-sm">{service.name}</span>
                          {service.serviceType !== 'recurring' && (
                            <Badge variant="secondary" className="text-[10px]">
                              {SERVICE_TYPE_LABELS[service.serviceType] || service.serviceType}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={service.hours}
                              onChange={e => updateHours(index, Number(e.target.value))}
                              className="w-16 h-8 text-xs"
                              disabled={!service.selected}
                            />
                            <span className="text-xs text-muted-foreground">h</span>
                          </div>
                          {service.selected && (
                            <span className="text-xs font-medium w-20 text-right">
                              R$ {(service.hours * deptRate).toFixed(0)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resultado Final - Always visible */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Resumo da Proposta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Por departamento */}
          {Object.entries(byDepartment).length > 0 ? (
            <>
              {Object.entries(byDepartment).map(([dept, data]) => (
                <div key={dept} className="flex items-center justify-between text-sm">
                  <span>{DEPARTMENTS[dept] || dept}</span>
                  <span className="text-muted-foreground">{data.hours}h × R$ {getDeptHourlyRate(dept).toFixed(0)}</span>
                  <span className="font-medium">R$ {data.value.toFixed(2)}</span>
                </div>
              ))}
              <Separator />

              {/* Subtotals */}
              {recurringServices.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span>Serviços Recorrentes ({totalRecurringHours}h)</span>
                  <span className="font-medium">R$ {totalRecurringValue.toFixed(2)}</span>
                </div>
              )}
              {extraServices.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    Serviços Extras/Pontuais
                    <Badge variant="secondary" className="text-[10px]">{extraServices.length}</Badge>
                  </span>
                  <span className="font-medium">R$ {totalExtraValue.toFixed(2)}</span>
                </div>
              )}

              {complexityScore !== 1 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Fator de complexidade (score: {complexityScore.toFixed(2)}x)
                    </span>
                    <span className="text-muted-foreground">
                      {complexityScore > 1 ? '+' : '-'} R$ {Math.abs(grandTotal - totalRecurringValue - totalExtraValue).toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Honorário Mensal</span>
                <span className="text-2xl font-bold text-primary">R$ {adjustedRecurringTotal.toFixed(2)}</span>
              </div>

              {extraServices.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">+ Serviços Extras</span>
                  <span className="font-medium">R$ {adjustedExtraTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
                <span className="font-bold">Total Geral</span>
                <span className="text-2xl font-bold text-primary">R$ {grandTotal.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Selecione serviços na aba "3. Serviços" para ver o resumo
            </p>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas sobre a proposta, condições especiais..." />
          </div>

          <Button onClick={handleSave} disabled={activeServices.length === 0 || createProposal.isPending} className="w-full">
            {createProposal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Salvar Proposta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
