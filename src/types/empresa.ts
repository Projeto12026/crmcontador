export type FormaEnvio = 'EMAIL' | 'WHATSAPP' | 'CORA';
export type EmpresaStatus = 'UNKNOWN' | 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'OVERDUE';

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
  active: number;
  inactive: number;
  pending: number;
  overdue: number;
  unknown: number;
}
