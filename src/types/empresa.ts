export type FormaEnvio = 'EMAIL' | 'WHATSAPP' | 'CORA' | 'NELSON';
export type EmpresaStatus = 'UNKNOWN' | 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'OVERDUE' | 'OPEN' | 'LATE' | 'PAID' | 'CANCELLED' | 'ERRO_CONSULTA';

export interface Empresa {
  id: string;
  nome: string;
  apelido: string | null;
  cnpj: string;
  dia_vencimento: number | null;
  forma_envio: FormaEnvio;
  telefone: string | null;
  status: EmpresaStatus;
  amount: number | null;
  last_sync: string | null;
  last_status_update: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmpresaStats {
  total: number;
  open: number;
  late: number;
  paid: number;
  cancelled: number;
  erro_consulta: number;
  unknown: number;
  active: number;
  inactive: number;
  pending: number;
  overdue: number;
}

export interface ProcessBoletoPayload {
  empresa: {
    nome: string;
    cnpj: string;
    telefone: string;
    apelido?: string;
  };
  competencia: string; // "MM/AAAA"
  invoiceId?: string;
}

export interface ProcessBoletoResult {
  success: boolean;
  invoiceId?: string;
  message?: string;
  error?: string;
  step?: string;
  details?: {
    empresa: string;
    competencia: string;
    valor: string;
    vencimento: string;
    isLate: boolean;
    daysOverdue: number;
  };
}

export interface BoletoStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}
