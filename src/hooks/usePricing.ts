import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PricingServiceCatalog {
  id: string;
  name: string;
  department: string;
  description: string | null;
  default_hours_per_month: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingProposal {
  id: string;
  client_id: string | null;
  client_name: string | null;
  status: string;
  tax_regime: string | null;
  num_employees: number;
  num_monthly_invoices: number;
  monthly_revenue: number;
  hourly_cost: number;
  markup_percentage: number;
  total_monthly_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: PricingProposalItem[];
  client?: { id: string; name: string } | null;
}

export interface PricingProposalItem {
  id: string;
  proposal_id: string;
  service_catalog_id: string | null;
  service_name: string;
  department: string;
  hours_per_month: number;
  hourly_rate: number;
  monthly_value: number;
  notes: string | null;
  created_at: string;
}

export interface PricingProposalFormData {
  client_id?: string | null;
  client_name?: string | null;
  tax_regime?: string;
  num_employees?: number;
  num_monthly_invoices?: number;
  monthly_revenue?: number;
  hourly_cost: number;
  markup_percentage: number;
  notes?: string;
  items: {
    service_catalog_id?: string | null;
    service_name: string;
    department: string;
    hours_per_month: number;
    hourly_rate: number;
    monthly_value: number;
  }[];
}

// ============ SERVICE CATALOG ============

export function useServiceCatalog() {
  return useQuery({
    queryKey: ['pricing-service-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_service_catalog')
        .select('*')
        .eq('is_active', true)
        .order('department')
        .order('name');
      if (error) throw error;
      return data as PricingServiceCatalog[];
    },
  });
}

export function useCreateServiceCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<PricingServiceCatalog>) => {
      const { data, error } = await supabase
        .from('pricing_service_catalog')
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-service-catalog'] });
      toast.success('Serviço adicionado ao catálogo');
    },
    onError: () => toast.error('Erro ao adicionar serviço'),
  });
}

export function useUpdateServiceCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PricingServiceCatalog> }) => {
      const { error } = await supabase
        .from('pricing_service_catalog')
        .update(data as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-service-catalog'] });
      toast.success('Serviço atualizado');
    },
    onError: () => toast.error('Erro ao atualizar serviço'),
  });
}

export function useDeleteServiceCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_service_catalog')
        .update({ is_active: false } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-service-catalog'] });
      toast.success('Serviço removido');
    },
    onError: () => toast.error('Erro ao remover serviço'),
  });
}

// ============ PROPOSALS ============

export function usePricingProposals() {
  return useQuery({
    queryKey: ['pricing-proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_proposals')
        .select('*, clients(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]).map(p => ({
        ...p,
        client: p.clients || null,
      })) as PricingProposal[];
    },
  });
}

export function usePricingProposal(id: string | null) {
  return useQuery({
    queryKey: ['pricing-proposal', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_proposals')
        .select('*, clients(id, name), pricing_proposal_items(*)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return {
        ...data,
        client: (data as any).clients || null,
        items: (data as any).pricing_proposal_items || [],
      } as PricingProposal;
    },
  });
}

export function useCreatePricingProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: PricingProposalFormData) => {
      const { items, ...proposalData } = formData;
      const totalValue = items.reduce((sum, i) => sum + i.monthly_value, 0);

      const { data: proposal, error } = await supabase
        .from('pricing_proposals')
        .insert({ ...proposalData, total_monthly_value: totalValue } as any)
        .select()
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const itemsToInsert = items.map(i => ({
          ...i,
          proposal_id: (proposal as any).id,
        }));
        const { error: itemsError } = await supabase
          .from('pricing_proposal_items')
          .insert(itemsToInsert as any);
        if (itemsError) throw itemsError;
      }

      return proposal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-proposals'] });
      toast.success('Proposta de honorários criada');
    },
    onError: () => toast.error('Erro ao criar proposta'),
  });
}

export function useDeletePricingProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_proposals')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-proposals'] });
      toast.success('Proposta excluída');
    },
    onError: () => toast.error('Erro ao excluir proposta'),
  });
}

export function useUpdateProposalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('pricing_proposals')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-proposals'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });
}
