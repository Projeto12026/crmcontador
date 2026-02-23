import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Building2, Users, FileText, DollarSign, MapPin, Shield, AlertTriangle } from 'lucide-react';

export interface DiagnosticData {
  clientId: string;
  clientName: string;
  taxRegime: string;
  companyType: string;
  numEmployees: number;
  numInvoices: number;
  monthlyRevenue: number;
  numBranches: number;
  hasDigitalCertificate: boolean;
  fiscalComplexity: string;
  revenueBracket: string;
}

const TAX_REGIMES = [
  { value: 'mei', label: 'MEI' },
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
];

const COMPANY_TYPES = [
  { value: 'servicos', label: 'Serviços' },
  { value: 'comercio', label: 'Comércio' },
  { value: 'industria', label: 'Indústria' },
  { value: 'misto', label: 'Misto (Ind./Com.)' },
];

const FISCAL_COMPLEXITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'muito_alta', label: 'Muito Alta' },
];

const REVENUE_BRACKETS = [
  { value: 'ate_100k', label: 'Até R$ 100 mil/mês' },
  { value: '100k_500k', label: 'R$ 100 mil a R$ 500 mil' },
  { value: '500k_2m', label: 'R$ 500 mil a R$ 2 milhões' },
  { value: 'acima_2m', label: 'Acima de R$ 2 milhões' },
];

interface Props {
  data: DiagnosticData;
  onChange: (data: DiagnosticData) => void;
  clients?: { id: string; name: string }[];
}

function getRevenueBracket(revenue: number): string {
  if (revenue <= 100000) return 'ate_100k';
  if (revenue <= 500000) return '100k_500k';
  if (revenue <= 2000000) return '500k_2m';
  return 'acima_2m';
}

export function ClientDiagnostic({ data, onChange, clients }: Props) {
  const update = (field: keyof DiagnosticData, value: any) => {
    const newData = { ...data, [field]: value };
    if (field === 'monthlyRevenue') {
      newData.revenueBracket = getRevenueBracket(value);
    }
    onChange(newData);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Diagnóstico do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client selection */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cliente Cadastrado (opcional)</Label>
            <Select value={data.clientId || 'none'} onValueChange={v => {
              if (v === 'none') {
                update('clientId', '');
              } else {
                const client = clients?.find(c => c.id === v);
                onChange({ ...data, clientId: v, clientName: client?.name || '' });
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (informar nome)</SelectItem>
                {clients?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(!data.clientId || data.clientId === 'none') && (
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input value={data.clientName} onChange={e => update('clientName', e.target.value)} placeholder="Razão social..." />
            </div>
          )}
        </div>

        {/* Main criteria grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" />Regime Tributário</Label>
            <Select value={data.taxRegime} onValueChange={v => update('taxRegime', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAX_REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />Tipo de Atividade</Label>
            <Select value={data.companyType} onValueChange={v => update('companyType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Complexidade Fiscal</Label>
            <Select value={data.fiscalComplexity} onValueChange={v => update('fiscalComplexity', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FISCAL_COMPLEXITIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Nº Funcionários</Label>
            <Input type="number" min={0} value={data.numEmployees} onChange={e => update('numEmployees', Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />NFs/Mês</Label>
            <Input type="number" min={0} value={data.numInvoices} onChange={e => update('numInvoices', Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Faturamento/Mês (R$)</Label>
            <Input type="number" min={0} value={data.monthlyRevenue} onChange={e => update('monthlyRevenue', Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Nº Filiais</Label>
            <Input type="number" min={0} value={data.numBranches} onChange={e => update('numBranches', Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Faixa de Faturamento</Label>
            <Select value={data.revenueBracket} onValueChange={v => update('revenueBracket', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REVENUE_BRACKETS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <Switch checked={data.hasDigitalCertificate} onCheckedChange={v => update('hasDigitalCertificate', v)} />
            <Label>Possui Certificado Digital</Label>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

export function getDefaultDiagnostic(): DiagnosticData {
  return {
    clientId: '',
    clientName: '',
    taxRegime: 'simples',
    companyType: 'servicos',
    numEmployees: 0,
    numInvoices: 0,
    monthlyRevenue: 0,
    numBranches: 0,
    hasDigitalCertificate: false,
    fiscalComplexity: 'baixa',
    revenueBracket: 'ate_100k',
  };
}
