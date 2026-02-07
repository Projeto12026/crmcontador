import { useState } from 'react';
import { useLeads, useCreateLead, useUpdateLead, useConvertLead, useDeleteLead } from '@/hooks/useLeads';
import { Lead, LeadFormData, LeadStatus } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, UserCheck, Trash2, Loader2, ArrowRight } from 'lucide-react';

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  prospecting: { label: 'Prospecção', color: 'bg-slate-100 text-slate-700' },
  contact: { label: 'Contato', color: 'bg-blue-100 text-blue-700' },
  proposal: { label: 'Proposta', color: 'bg-purple-100 text-purple-700' },
  negotiation: { label: 'Negociação', color: 'bg-orange-100 text-orange-700' },
  won: { label: 'Ganho', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Perdido', color: 'bg-red-100 text-red-700' },
};

const funnelStages: LeadStatus[] = ['prospecting', 'contact', 'proposal', 'negotiation'];

export function CommercialPage() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: leads, isLoading } = useLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const convertLead = useConvertLead();
  const deleteLead = useDeleteLead();

  const [formData, setFormData] = useState<LeadFormData>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    source: '',
    expected_value: undefined,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLead.mutateAsync(formData);
    setIsOpen(false);
    setFormData({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      source: '',
      expected_value: undefined,
      notes: '',
    });
  };

  const moveToNextStage = (lead: Lead) => {
    const currentIndex = funnelStages.indexOf(lead.status);
    if (currentIndex < funnelStages.length - 1) {
      updateLead.mutate({ id: lead.id, data: { status: funnelStages[currentIndex + 1] } });
    }
  };

  const getLeadsByStatus = (status: LeadStatus) => 
    leads?.filter((l) => l.status === status) || [];

  const totalPipeline = leads
    ?.filter((l) => !['won', 'lost'].includes(l.status))
    .reduce((sum, l) => sum + (l.expected_value || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Comercial</h1>
          <p className="text-muted-foreground">
            Pipeline: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPipeline)}
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {funnelStages.map((status) => (
            <Card key={status}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{statusConfig[status].label}</span>
                  <Badge variant="secondary">{getLeadsByStatus(status).length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getLeadsByStatus(status).map((lead) => (
                  <div key={lead.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="font-medium">{lead.company_name}</div>
                    {lead.contact_name && (
                      <div className="text-sm text-muted-foreground">{lead.contact_name}</div>
                    )}
                    {lead.expected_value && (
                      <div className="text-sm font-medium text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.expected_value)}
                      </div>
                    )}
                    <div className="flex gap-1 pt-1">
                      {status !== 'negotiation' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveToNextStage(lead)}
                          title="Avançar etapa"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                      {status === 'negotiation' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => convertLead.mutate(lead.id)}
                          title="Converter em cliente"
                          className="text-green-600"
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateLead.mutate({ id: lead.id, data: { status: 'lost' } })}
                        title="Marcar como perdido"
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {getLeadsByStatus(status).length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Nenhum lead
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Won/Lost summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Ganhos ({getLeadsByStatus('won').length})</CardTitle>
          </CardHeader>
          <CardContent>
            {getLeadsByStatus('won').slice(0, 5).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span>{lead.company_name}</span>
                {lead.expected_value && (
                  <span className="text-green-600 font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.expected_value)}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Perdidos ({getLeadsByStatus('lost').length})</CardTitle>
          </CardHeader>
          <CardContent>
            {getLeadsByStatus('lost').slice(0, 5).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-muted-foreground">{lead.company_name}</span>
                <Button variant="ghost" size="sm" onClick={() => deleteLead.mutate(lead.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Empresa *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contato</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Origem</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Ex: Indicação, Site..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_value">Valor Esperado</Label>
              <Input
                id="expected_value"
                type="number"
                value={formData.expected_value || ''}
                onChange={(e) => setFormData({ ...formData, expected_value: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createLead.isPending}>
                {createLead.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
