import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calculator, Save, Loader2, Clock, DollarSign, Percent, Users, FileText, Building2 } from 'lucide-react';
import { useServiceCatalog, useCreatePricingProposal, PricingServiceCatalog } from '@/hooks/usePricing';
import { useClients } from '@/hooks/useClients';

const DEPARTMENTS: Record<string, string> = {
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  pessoal: 'Pessoal',
  societario: 'Societário',
  consultoria: 'Consultoria',
};

const TAX_REGIMES = [
  { value: 'mei', label: 'MEI' },
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
];

interface SelectedService {
  catalog_id: string;
  name: string;
  department: string;
  hours: number;
  selected: boolean;
}

export function PricingSimulator() {
  const { data: catalog } = useServiceCatalog();
  const { data: clients } = useClients();
  const createProposal = useCreatePricingProposal();

  // Config
  const [hourlyCost, setHourlyCost] = useState(80);
  const [markupPct, setMarkupPct] = useState(30);

  // Client info
  const [clientId, setClientId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [taxRegime, setTaxRegime] = useState('simples');
  const [numEmployees, setNumEmployees] = useState(0);
  const [numInvoices, setNumInvoices] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [notes, setNotes] = useState('');

  // Services
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize services from catalog
  if (catalog && !initialized) {
    setSelectedServices(
      catalog.map(s => ({
        catalog_id: s.id,
        name: s.name,
        department: s.department,
        hours: s.default_hours_per_month,
        selected: false,
      }))
    );
    setInitialized(true);
  }

  const hourlyRate = hourlyCost * (1 + markupPct / 100);

  const toggleService = (index: number) => {
    setSelectedServices(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s));
  };

  const updateHours = (index: number, hours: number) => {
    setSelectedServices(prev => prev.map((s, i) => i === index ? { ...s, hours } : s));
  };

  const activeServices = selectedServices.filter(s => s.selected);
  const totalHours = activeServices.reduce((sum, s) => sum + s.hours, 0);
  const totalValue = totalHours * hourlyRate;

  const byDepartment = useMemo(() => {
    const grouped: Record<string, { hours: number; value: number }> = {};
    activeServices.forEach(s => {
      if (!grouped[s.department]) grouped[s.department] = { hours: 0, value: 0 };
      grouped[s.department].hours += s.hours;
      grouped[s.department].value += s.hours * hourlyRate;
    });
    return grouped;
  }, [activeServices, hourlyRate]);

  // Complexity multiplier based on client data
  const complexityMultiplier = useMemo(() => {
    let mult = 1;
    if (taxRegime === 'lucro_real') mult *= 1.4;
    else if (taxRegime === 'lucro_presumido') mult *= 1.2;
    else if (taxRegime === 'mei') mult *= 0.6;
    if (numEmployees > 50) mult *= 1.3;
    else if (numEmployees > 20) mult *= 1.15;
    else if (numEmployees > 5) mult *= 1.05;
    if (numInvoices > 200) mult *= 1.25;
    else if (numInvoices > 50) mult *= 1.1;
    return mult;
  }, [taxRegime, numEmployees, numInvoices]);

  const adjustedTotal = totalValue * complexityMultiplier;

  const handleSave = () => {
    const items = activeServices.map(s => ({
      service_catalog_id: s.catalog_id,
      service_name: s.name,
      department: s.department,
      hours_per_month: s.hours,
      hourly_rate: hourlyRate,
      monthly_value: s.hours * hourlyRate * complexityMultiplier,
    }));

    const selectedClient = clients?.find(c => c.id === clientId);

    createProposal.mutate({
      client_id: clientId || null,
      client_name: clientId ? selectedClient?.name || '' : clientName,
      tax_regime: taxRegime,
      num_employees: numEmployees,
      num_monthly_invoices: numInvoices,
      monthly_revenue: monthlyRevenue,
      hourly_cost: hourlyCost,
      markup_percentage: markupPct,
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
      {/* Config + Client info side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Configuração de Custo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Configuração de Custo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Custo/Hora (R$)
                </Label>
                <Input type="number" min={1} value={hourlyCost} onChange={e => setHourlyCost(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Percent className="h-3.5 w-3.5" />
                  Markup (%)
                </Label>
                <Input type="number" min={0} value={markupPct} onChange={e => setMarkupPct(Number(e.target.value))} />
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Valor Hora Cobrado</p>
              <p className="text-2xl font-bold">R$ {hourlyRate.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Dados do Cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Select value={clientId} onValueChange={v => { setClientId(v); setClientName(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (informar nome)</SelectItem>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(!clientId || clientId === 'none') && (
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome da empresa..." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Regime Tributário</Label>
                <Select value={taxRegime} onValueChange={setTaxRegime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_REGIMES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Nº Funcionários
                </Label>
                <Input type="number" min={0} value={numEmployees} onChange={e => setNumEmployees(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  NFs/Mês
                </Label>
                <Input type="number" min={0} value={numInvoices} onChange={e => setNumInvoices(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Faturamento/Mês (R$)</Label>
                <Input type="number" min={0} value={monthlyRevenue} onChange={e => setMonthlyRevenue(Number(e.target.value))} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seleção de Serviços */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Serviços (Ficha Técnica)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(DEPARTMENTS).map(([key, label]) => {
            const items = groupedCatalog[key];
            if (!items || items.length === 0) return null;
            return (
              <div key={key}>
                <h4 className="text-sm font-semibold mb-2">{label}</h4>
                <div className="space-y-1">
                  {items.map(({ index, service }) => (
                    <div key={index} className="flex items-center gap-3 rounded-lg border p-2">
                      <Checkbox
                        checked={service.selected}
                        onCheckedChange={() => toggleService(index)}
                      />
                      <span className="flex-1 text-sm">{service.name}</span>
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
                        <span className="text-xs text-muted-foreground">h/mês</span>
                      </div>
                      {service.selected && (
                        <span className="text-xs font-medium w-20 text-right">
                          R$ {(service.hours * hourlyRate).toFixed(0)}
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

      {/* Resultado */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo da Proposta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Por departamento */}
          {Object.entries(byDepartment).map(([dept, data]) => (
            <div key={dept} className="flex items-center justify-between text-sm">
              <span>{DEPARTMENTS[dept] || dept}</span>
              <span className="text-muted-foreground">{data.hours}h</span>
              <span className="font-medium">R$ {data.value.toFixed(2)}</span>
            </div>
          ))}

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span>Subtotal ({totalHours}h)</span>
            <span className="font-medium">R$ {totalValue.toFixed(2)}</span>
          </div>

          {complexityMultiplier !== 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Fator de complexidade ({(complexityMultiplier * 100 - 100).toFixed(0)}%)
              </span>
              <span className="text-muted-foreground">
                {complexityMultiplier > 1 ? '+' : '-'} R$ {Math.abs(adjustedTotal - totalValue).toFixed(2)}
              </span>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">Honorário Mensal</span>
            <span className="text-2xl font-bold text-primary">R$ {adjustedTotal.toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas sobre a proposta..." />
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
