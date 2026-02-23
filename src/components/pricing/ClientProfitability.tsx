import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  DollarSign,
  FileText,
  Building2,
  BookOpen,
  Calculator,
} from 'lucide-react';
import { useContracts } from '@/hooks/useContracts';

interface Props {
  clientId: string;
  clientName: string;
  calculatedIdealPrice: number;
  hasServicesSelected: boolean;
  isStandaloneProposal?: boolean;
}

interface RequirementCheck {
  label: string;
  location: string;
  fulfilled: boolean;
  icon: React.ReactNode;
}

export function ClientProfitability({ clientId, clientName, calculatedIdealPrice, hasServicesSelected, isStandaloneProposal }: Props) {
  const { data: contracts } = useContracts();

  const analysis = useMemo(() => {
    if (!clientId || !contracts) return null;

    const clientContracts = contracts.filter(
      c => c.client_id === clientId && c.status === 'active'
    );

    if (clientContracts.length === 0) return null;

    const totalContractValue = clientContracts.reduce(
      (sum, c) => sum + (c.monthly_value || 0), 0
    );

    const difference = totalContractValue - calculatedIdealPrice;
    const margin = calculatedIdealPrice > 0
      ? ((difference / calculatedIdealPrice) * 100)
      : 0;

    return {
      contractValue: totalContractValue,
      idealPrice: calculatedIdealPrice,
      difference,
      margin,
      isProfitable: difference >= 0,
      contractCount: clientContracts.length,
    };
  }, [clientId, contracts, calculatedIdealPrice]);

  // Check what data the user needs to fill in
  const requirements = useMemo((): RequirementCheck[] => {
    const checks: RequirementCheck[] = [];
    
    // Only require client/contract when NOT a standalone proposal
    if (!isStandaloneProposal) {
      checks.push(
        {
          label: 'Cliente selecionado no diagnóstico',
          location: 'Precificação → Simulador → aba "2. Diagnóstico"',
          fulfilled: !!clientId,
          icon: <Building2 className="h-3.5 w-3.5" />,
        },
        {
          label: 'Contrato ativo cadastrado para o cliente',
          location: 'Menu "Contratos" → criar contrato com valor mensal',
          fulfilled: !!analysis && analysis.contractCount > 0,
          icon: <FileText className="h-3.5 w-3.5" />,
        },
      );
    }

    checks.push(
      {
        label: 'Serviços selecionados na ficha técnica',
        location: 'Precificação → Simulador → aba "3. Serviços"',
        fulfilled: hasServicesSelected,
        icon: <BookOpen className="h-3.5 w-3.5" />,
      },
      {
        label: 'Custos departamentais configurados',
        location: 'Precificação → Simulador → aba "1. Custos & Markup"',
        fulfilled: calculatedIdealPrice > 0,
        icon: <Calculator className="h-3.5 w-3.5" />,
      },
    );
    return checks;
  }, [clientId, analysis, hasServicesSelected, calculatedIdealPrice, isStandaloneProposal]);

  const allRequirementsMet = requirements.every(r => r.fulfilled);
  const fulfilledCount = requirements.filter(r => r.fulfilled).length;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Análise de Lucratividade do Cliente
          {analysis && allRequirementsMet && (
            <Badge
              variant={analysis.isProfitable ? 'default' : 'destructive'}
              className="ml-auto"
            >
              {analysis.isProfitable ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {analysis.isProfitable ? 'LUCRO' : 'PREJUÍZO'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data requirements checklist */}
        <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              Requisitos para análise ({fulfilledCount}/{requirements.length} completos)
            </p>
          </div>
          <div className="space-y-1.5">
            {requirements.map((req, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {req.fulfilled ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                )}
                <div>
                  <span className={req.fulfilled ? 'text-muted-foreground line-through' : 'font-medium'}>
                    {req.label}
                  </span>
                  {!req.fulfilled && (
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                      {req.icon} {req.location}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profitability result */}
        {allRequirementsMet && analysis ? (
          <>
            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor do Contrato Atual</span>
                <span className="font-medium">
                  R$ {analysis.contractValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Preço Ideal Calculado</span>
                <span className="font-medium">
                  R$ {analysis.idealPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <Separator />

              <div
                className={`rounded-lg p-4 flex items-center justify-between ${
                  analysis.isProfitable
                    ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900'
                    : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900'
                }`}
              >
                <div>
                  <p className="text-sm font-medium">
                    {analysis.isProfitable ? 'Este cliente dá LUCRO' : 'Este cliente dá PREJUÍZO'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Margem de {analysis.margin.toFixed(1)}% sobre o preço ideal
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${
                      analysis.isProfitable
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {analysis.difference >= 0 ? '+' : '-'} R${' '}
                    {Math.abs(analysis.difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
              </div>

              {!analysis.isProfitable && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Ação recomendada</AlertTitle>
                  <AlertDescription className="text-xs">
                    O honorário contratado está abaixo do custo ideal. Considere renegociar o contrato
                    para R$ {analysis.idealPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                    ou revisar o escopo de serviços prestados.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Complete os requisitos acima para ver a análise de lucratividade
          </p>
        )}
      </CardContent>
    </Card>
  );
}
