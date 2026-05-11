/**
 * Cliente exclusivo do modulo financeiro: PostgREST sobre Postgres local (VPS).
 *
 * - Nao encaminha leituras/escritas dessas tabelas para o REST do Supabase.
 * - Sem VITE_LOCAL_DB_URL + VITE_LOCAL_DB_ANON_KEY, as requisicoes retornam erro
 *   sintetico NO_LOCAL_FINANCE_DB (503) — trate com isFinanceDataUnavailableError.
 *
 * Autenticacao continua no Supabase Auth: o access_token e enviado em Authorization
 * para o PostgREST aceitar o mesmo JWT (PGRST_JWT_SECRET alinhado ao Supabase).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { LocalDatabase } from './types';

const LOCAL_DB_URL =
  (typeof window !== 'undefined' && window.__ENV__?.VITE_LOCAL_DB_URL) ||
  import.meta.env.VITE_LOCAL_DB_URL ||
  '';

const LOCAL_DB_ANON_KEY =
  (typeof window !== 'undefined' && window.__ENV__?.VITE_LOCAL_DB_ANON_KEY) ||
  import.meta.env.VITE_LOCAL_DB_ANON_KEY ||
  '';

const DISABLED_FINANCE_URL = 'https://local-finance.invalid';

function makeDisabledFinanceResponse(): Response {
  return new Response(
    JSON.stringify({
      code: 'NO_LOCAL_FINANCE_DB',
      message:
        'Defina VITE_LOCAL_DB_URL e VITE_LOCAL_DB_ANON_KEY. Dados financeiros usam somente o Postgres local via PostgREST, nao o REST do Supabase.',
      details: '',
      hint: '',
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}

/** PostgREST financeiro configurado (URL + chave anon JWT). */
export const LOCAL_DB_ENABLED = Boolean(LOCAL_DB_URL && LOCAL_DB_ANON_KEY);

function makeLocalClient(): SupabaseClient<LocalDatabase> {
  const customFetch: typeof fetch = async (input, init) => {
    let auth: Record<string, string> = {};
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        auth = { Authorization: `Bearer ${token}` };
      }
    } catch {
      // sem sessao: supabase-js usa apiKey como Authorization
    }

    const headers = new Headers(init?.headers);
    for (const [k, v] of Object.entries(auth)) headers.set(k, v);

    return fetch(input, { ...init, headers });
  };

  return createClient<LocalDatabase>(LOCAL_DB_URL, LOCAL_DB_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: customFetch,
    },
  });
}

function makeDisabledFinanceClient(): SupabaseClient<LocalDatabase> {
  const customFetch: typeof fetch = async () => makeDisabledFinanceResponse();

  return createClient<LocalDatabase>(DISABLED_FINANCE_URL, 'local-finance-placeholder', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: customFetch },
  });
}

/**
 * Use apenas para: account_categories, financial_accounts, cash_flow_transactions,
 * financial_categories, financial_transactions, credit_cards, credit_card_invoices, RPC compute_invoice_for_card.
 */
export const localDb: SupabaseClient = (
  LOCAL_DB_ENABLED ? makeLocalClient() : makeDisabledFinanceClient()
) as unknown as SupabaseClient;
