import { useEmpresaStats } from '@/hooks/useEmpresas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2, Clock, AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

const statusConfig = [
  { key: 'open', label: 'Abertos', icon: Clock, color: 'text-blue-600' },
  { key: 'late', label: 'Atrasados', icon: AlertTriangle, color: 'text-destructive' },
  { key: 'paid', label: 'Pagos', icon: CheckCircle, color: 'text-primary' },
  { key: 'cancelled', label: 'Cancelados', icon: XCircle, color: 'text-muted-foreground' },
  { key: 'erro_consulta', label: 'Erro Consulta', icon: AlertTriangle, color: 'text-orange-600' },
  { key: 'unknown', label: 'Desconhecido', icon: HelpCircle, color: 'text-muted-foreground' },
] as const;

export function EmpresaStats() {
  const { data: stats, isLoading } = useEmpresaStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Total de Empresas: {stats?.total || 0}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statusConfig.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.[key as keyof typeof stats] || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
                <Icon className={`h-8 w-8 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
