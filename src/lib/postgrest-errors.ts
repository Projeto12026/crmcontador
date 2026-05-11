/**
 * Erros do backend financeiro (PostgREST local) — sem uso do REST do Supabase para dados.
 */

/** Texto para UI/toasts (Postgres local obrigatorio para dados financeiros). */
export const FINANCE_DB_USER_HINT =
  'Configure VITE_LOCAL_DB_URL e VITE_LOCAL_DB_ANON_KEY (URL publica do PostgREST + JWT anon com role anon). Os dados financeiros ficam no Postgres local, nao no projeto Supabase. Veja finance-db/README.md.';

/** Alias para codigo legado / cartoes. */
export const CREDIT_FINANCE_SCHEMA_HINT = FINANCE_DB_USER_HINT;

export function isNoLocalFinanceDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (String(e.code) === 'NO_LOCAL_FINANCE_DB') return true;
  return false;
}

/** Tabela ausente no PostgREST / migracao SQL nao aplicada no banco que esta por tras do PostgREST. */
export function isCreditFinanceSchemaMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string };
  const msg = `${e.message || ''} ${e.details || ''}`.toLowerCase();
  const code = String(e.code || '');

  if (code === 'PGRST205') return true;
  if (code === '42P01') return true;

  if (msg.includes('credit_cards') && msg.includes('schema cache')) return true;
  if (msg.includes('credit_card_invoices') && msg.includes('schema cache')) return true;
  if (msg.includes('relation') && msg.includes('credit_cards') && msg.includes('does not exist')) return true;
  if (msg.includes('relation') && msg.includes('credit_card_invoices') && msg.includes('does not exist')) return true;

  const status = (error as { status?: number }).status;
  if (status === 404 && (msg.includes('credit') || msg.includes('schema'))) return true;

  return false;
}

export function isFinanceDataUnavailableError(error: unknown): boolean {
  return isNoLocalFinanceDbError(error) || isCreditFinanceSchemaMissingError(error);
}

/** Se erro for "DB financeiro indisponivel", devolve `fallback`. Caso contrario, lanca. */
export function handleFinanceQueryError<T>(error: unknown, fallback: T): T {
  if (isFinanceDataUnavailableError(error)) return fallback;
  throw error;
}

/** onError de mutations do modulo financeiro. */
export function financeMutationToast(
  toast: (opts: { title: string; description?: string; variant?: 'destructive' }) => void,
  defaultTitle: string,
  error: unknown,
): void {
  if (isFinanceDataUnavailableError(error)) {
    toast({ title: 'Banco financeiro indisponivel', description: FINANCE_DB_USER_HINT, variant: 'destructive' });
    return;
  }
  toast({
    title: defaultTitle,
    description: error instanceof Error ? error.message : String(error),
    variant: 'destructive',
  });
}
