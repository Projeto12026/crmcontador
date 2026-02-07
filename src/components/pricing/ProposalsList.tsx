import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Trash2, Building2, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  usePricingProposals,
  usePricingProposal,
  useDeletePricingProposal,
  useUpdateProposalStatus,
  PricingProposal,
} from '@/hooks/usePricing';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviada', variant: 'default' },
  approved: { label: 'Aprovada', variant: 'default' },
  rejected: { label: 'Recusada', variant: 'destructive' },
};

const DEPARTMENTS: Record<string, string> = {
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  pessoal: 'Pessoal',
  societario: 'Societário',
  consultoria: 'Consultoria',
};

export function ProposalsList() {
  const { data: proposals, isLoading } = usePricingProposals();
  const deleteProposal = useDeletePricingProposal();
  const updateStatus = useUpdateProposalStatus();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const { data: viewingProposal } = usePricingProposal(viewingId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposals || proposals.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma proposta criada ainda</p>
        <p className="text-sm mt-1">Use o Simulador para criar sua primeira proposta</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {proposals.map(proposal => {
        const status = STATUS_MAP[proposal.status] || STATUS_MAP.draft;
        return (
          <Card key={proposal.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">
                    {proposal.client?.name || proposal.client_name || 'Sem cliente'}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  <span>{proposal.tax_regime?.toUpperCase() || '—'}</span>
                  <span>{proposal.num_employees} func.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold">R$ {proposal.total_monthly_value.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
                <Select
                  value={proposal.status}
                  onValueChange={v => updateStatus.mutate({ id: proposal.id, status: v })}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingId(proposal.id)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProposal.mutate(proposal.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Detail dialog */}
      <Dialog open={!!viewingId} onOpenChange={open => !open && setViewingId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Proposta</DialogTitle>
          </DialogHeader>
          {viewingProposal ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente</span>
                  <p className="font-medium">{viewingProposal.client?.name || viewingProposal.client_name || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Regime</span>
                  <p className="font-medium">{viewingProposal.tax_regime?.toUpperCase() || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Custo/Hora</span>
                  <p className="font-medium">R$ {viewingProposal.hourly_cost.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Markup</span>
                  <p className="font-medium">{viewingProposal.markup_percentage}%</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Serviços</h4>
                {viewingProposal.items?.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm border rounded-lg p-2">
                    <div>
                      <p className="font-medium">{item.service_name}</p>
                      <p className="text-xs text-muted-foreground">{DEPARTMENTS[item.department] || item.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">R$ {item.monthly_value.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{item.hours_per_month}h × R$ {item.hourly_rate.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Total Mensal</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {viewingProposal.total_monthly_value.toFixed(2)}
                </span>
              </div>

              {viewingProposal.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Observações</span>
                  <p className="text-sm mt-1">{viewingProposal.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
