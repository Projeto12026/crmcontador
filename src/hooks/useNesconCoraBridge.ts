import { useQuery } from '@tanstack/react-query';
import { endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/** Contratos Nescon ativos com documento do cliente (CNPJ) — permanece no Supabase (CRM). */
export type NesconContractWithClientDoc = {
  monthly_value: number | null;
  client_id: string | null;
  clients: { document: string | null } | null;
};

export function useNesconActiveContractsWithDocuments() {
  return useQuery({
    queryKey: ['nescon-contracts-with-client-documents'],
    queryFn: async (): Promise<NesconContractWithClientDoc[]> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('monthly_value, client_id, clients(document)')
        .eq('manager', 'nescon')
        .eq('status', 'active');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type CoraBoletoPaidRow = {
  cnpj: string | null;
  total_amount_cents: number | null;
  paid_at: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
};

/** Boletos Cora pagos filtrados por CNPJs e competência — tabela no Supabase. */
export function useCoraPaidBoletosInPeriod(
  cnpjs: string[],
  startDate: string | undefined,
  endDate: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['cora-boletos-paid-filtered', cnpjs, startDate, endDate],
    queryFn: async (): Promise<CoraBoletoPaidRow[]> => {
      if (cnpjs.length === 0) return [];
      const { data, error } = await supabase
        .from('cora_boletos')
        .select('cnpj, total_amount_cents, paid_at, competencia_mes, competencia_ano');
      if (error) throw error;
      return (data || []).filter((b: CoraBoletoPaidRow) => {
        if (!b.paid_at) return false;
        const bCnpj = (b.cnpj || '').replace(/[^\d]/g, '');
        if (!cnpjs.includes(bCnpj)) return false;
        if (startDate && endDate && b.competencia_ano != null && b.competencia_mes != null) {
          const bDate = new Date(b.competencia_ano, b.competencia_mes - 1);
          const sDate = parseISO(startDate);
          const eDate = parseISO(endDate);
          return bDate >= startOfMonth(sDate) && bDate <= endOfMonth(eDate);
        }
        return true;
      });
    },
    enabled: enabled && cnpjs.length > 0,
  });
}

export function nesconContractCnpjsFromContracts(
  contracts: NesconContractWithClientDoc[] | undefined,
): string[] {
  if (!contracts?.length) return [];
  return contracts
    .map((c) => c.clients?.document?.replace(/[^\d]/g, '') ?? '')
    .filter(Boolean);
}
