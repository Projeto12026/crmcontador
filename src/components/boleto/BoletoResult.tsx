import { BoletoStep } from '@/types/empresa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoletoResultProps {
  steps: BoletoStep[];
  result?: {
    success: boolean;
    details?: {
      empresa: string;
      competencia: string;
      valor: string;
      vencimento: string;
      isLate: boolean;
      daysOverdue: number;
    };
    error?: string;
  };
}

const stepIcons = {
  pending: Circle,
  loading: Loader2,
  success: CheckCircle2,
  error: XCircle,
};

const stepColors = {
  pending: 'text-muted-foreground',
  loading: 'text-primary animate-spin',
  success: 'text-primary',
  error: 'text-destructive',
};

export function BoletoResult({ steps, result }: BoletoResultProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Progresso do Envio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = stepIcons[step.status];
            return (
              <div key={step.id} className="flex items-start gap-3">
                <div className="relative">
                  <Icon className={cn('h-5 w-5', stepColors[step.status])} />
                  {index < steps.length - 1 && (
                    <div className="absolute left-2.5 top-6 h-6 w-px bg-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    step.status === 'error' && 'text-destructive'
                  )}>
                    {step.label}
                  </p>
                  {step.error && (
                    <p className="text-xs text-destructive mt-1">{step.error}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {result?.success && result.details && (
          <div className="bg-primary/5 rounded-lg p-4 mt-4 space-y-2">
            <p className="font-medium text-primary">✓ Boleto enviado com sucesso!</p>
            <div className="text-sm space-y-1">
              <p><strong>Empresa:</strong> {result.details.empresa}</p>
              <p><strong>Competência:</strong> {result.details.competencia}</p>
              <p><strong>Valor:</strong> R$ {result.details.valor}</p>
              <p><strong>Vencimento:</strong> {result.details.vencimento}</p>
              {result.details.isLate && (
                <p className="text-destructive">
                  <strong>Atraso:</strong> {result.details.daysOverdue} dias
                </p>
              )}
            </div>
          </div>
        )}

        {result?.success === false && result.error && (
          <div className="bg-destructive/10 rounded-lg p-4 mt-4">
            <p className="font-medium text-destructive">✗ Erro no envio</p>
            <p className="text-sm text-destructive mt-1">{result.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
