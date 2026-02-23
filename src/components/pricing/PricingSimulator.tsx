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
import { Calculator, Save, Loader2, Clock, DollarSign, Zap, Plus, Trash2 } from 'lucide-react';
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
  included_employees: number | null;
  additional_employee_value: number | null;
  num_employees: number;
}

interface Surcharge {
  label: string;
  value: number;
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

  // Surcharges (acréscimos de mensalidade)
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);

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
        included_employees: s.included_employees,
        additional_employee_value: s.additional_employee_value,
        num_employees: 0,
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

  const updateNumEmployees = (index: number, num: number) => {
    setSelectedServices(prev => prev.map((s, i) => i === index ? { ...s, num_employees: num } : s));
  };

  const getAdditionalEmployeeCost = (s: SelectedService): number => {
    if (!s.included_employees || !s.additional_employee_value || s.num_employees <= s.included_employees) return 0;
    return (s.num_employees - s.included_employees) * s.additional_employee_value;
  };

  const activeServices = selectedServices.filter(s => s.selected);
  const recurringServices = activeServices.filter(s => s.serviceType === 'recurring');
  const extraServices = activeServices.filter(s => s.serviceType !== 'recurring');

  const totalRecurringHours = recurringServices.reduce((sum, s) => sum + s.hours, 0);
  const totalRecurringValue = recurringServices.reduce((sum, s) => sum + s.hours * getDeptHourlyRate(s.department) + getAdditionalEmployeeCost(s), 0);
  const totalExtraValue = extraServices.reduce((sum, s) => sum + s.hours * getDeptHourlyRate(s.department) + getAdditionalEmployeeCost(s), 0);

  const complexityScore = computeComplexityScore(diagnostic);
  const adjustedRecurringTotal = totalRecurringValue * complexityScore;
  const adjustedExtraTotal = totalExtraValue * complexityScore;
  const totalSurcharges = surcharges.reduce((sum, s) => sum + s.value, 0);
  const grandTotal = adjustedRecurringTotal + adjustedExtraTotal + totalSurcharges;

  const isStandaloneProposal = !diagnostic.clientId;

  const byDepartment = useMemo(() => {
    const grouped: Record<string, { hours: number; value: number }> = {};
    activeServices.forEach(s => {
      if (!grouped[s.department]) grouped[s.department] = { hours: 0, value: 0 };
      grouped[s.department].hours += s.hours;
      grouped[s.department].value += s.hours * getDeptHourlyRate(s.department) + getAdditionalEmployeeCost(s);
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
      monthly_value: (s.hours * getDeptHourlyRate(s.department) + getAdditionalEmployeeCost(s)) * complexityScore,
    }));

    const selectedClient = clients?.find(c => c.id === diagnostic.clientId);

    // Include surcharges info in notes
    const surchargeNotes = surcharges.filter(s => s.value > 0).map(s => `Acréscimo: ${s.label || 'Sem descrição'} - R$ ${s.value.toFixed(2)}`).join('\n');
    const fullNotes = [notes, surchargeNotes].filter(Boolean).join('\n\n');

    // Add surcharges as proposal items
    const surchargeItems = surcharges.filter(s => s.value > 0).map(s => ({
      service_name: `Acréscimo: ${s.label || 'Acréscimo'}`,
      department: 'consultoria',
      hours_per_month: 0,
      hourly_rate: 0,
      monthly_value: s.value,
    }));

    createProposal.mutate({
      client_id: diagnostic.clientId || null,
      client_name: diagnostic.clientId ? selectedClient?.name || '' : (diagnostic.clientName || 'Proposta Avulsa'),
      tax_regime: diagnostic.taxRegime,
      num_employees: diagnostic.numEmployees,
      num_monthly_invoices: diagnostic.numInvoices,
      monthly_revenue: diagnostic.monthlyRevenue,
      hourly_cost: Object.values(costConfig.departments).reduce((sum, d) => sum + d.costPerHour, 0) / Object.keys(costConfig.departments).length,
      markup_percentage: totalMarkup,
      notes: fullNotes,
      items: [...items, ...surchargeItems],
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
            isStandaloneProposal={isStandaloneProposal}
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
                      {items.map(({ index, service }) => {
                        const empCost = getAdditionalEmployeeCost(service);
                        const lineTotal = service.hours * deptRate + empCost;
                        return (
                        <div key={index} className="rounded-lg border p-2 space-y-1">
                          <div className="flex items-center gap-3">
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
                                R$ {lineTotal.toFixed(0)}
                              </span>
                            )}
                          </div>
                          {service.selected && service.included_employees != null && (
                            <div className="flex items-center gap-2 ml-7 text-xs text-muted-foreground">
                              <span>Funcionários:</span>
                              <Input
                                type="number"
                                min={0}
                                value={service.num_employees}
                                onChange={e => updateNumEmployees(index, Number(e.target.value))}
                                className="w-16 h-7 text-xs"
                              />
                              <span className="whitespace-nowrap">
                                ({service.included_employees} inclusos
                                {service.num_employees > service.included_employees
                                  ? `, +${service.num_employees - service.included_employees} × R$ ${service.additional_employee_value?.toFixed(0)} = R$ ${empCost.toFixed(0)}`
                                  : ''}
                                )
                              </span>
                            </div>
                          )}
                        </div>
                        );
                      })}
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
                      {complexityScore > 1 ? '+' : '-'} R$ {Math.abs((adjustedRecurringTotal + adjustedExtraTotal) - totalRecurringValue - totalExtraValue).toFixed(2)}
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

              {/* Acréscimos de Mensalidade */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Acréscimos de Mensalidade</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSurcharges(prev => [...prev, { label: '', value: 0 }])}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
                {surcharges.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={s.label}
                      onChange={e => setSurcharges(prev => prev.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item))}
                      placeholder="Ex: Certificado Digital, Software..."
                      className="flex-1 h-8 text-xs"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={s.value}
                        onChange={e => setSurcharges(prev => prev.map((item, idx) => idx === i ? { ...item, value: Number(e.target.value) } : item))}
                        className="w-24 h-8 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSurcharges(prev => prev.filter((_, idx) => idx !== i))}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {surcharges.length > 0 && totalSurcharges > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal Acréscimos</span>
                    <span className="font-medium">+ R$ {totalSurcharges.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <Separator />

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
