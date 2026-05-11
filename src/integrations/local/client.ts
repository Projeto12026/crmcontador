/**
 * Cliente exclusivo do modulo financeiro: PostgREST sobre Postgres local (VPS).
 *
 * - Nao encaminha leituras/escritas dessas tabelas para o REST do Supabase.
 * - Sem VITE_LOCAL_DB_URL + VITE_LOCAL_DB_ANON_KEY, as requisicoes retornam erro
 *   sintetico NO_LOCAL_FINANCE_DB (503) — trate com isFinanceDataUnavailableError.
 *
 * Leitura de URL/chave e lazy (Proxy): assim window.__ENV__ de /config.js esta
 * disponivel antes do primeiro .from(), mesmo com ordem sutil de scripts no HTML.
 *
 * Autenticacao continua no Supabase Auth: o access_token e enviado em Authorization
 * para o PostgREST aceitar o mesmo JWT (PGRST_JWT_SECRET alinhado ao Supabase).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { LocalDatabase } from './types';

function readLocalDbUrl(): string {
  if (typeof window !== 'undefined' && window.__ENV__?.VITE_LOCAL_DB_URL) {
    const v = String(window.__ENV__.VITE_LOCAL_DB_URL).trim();
    if (v) return v;
  }
  const fromVite = import.meta.env.VITE_LOCAL_DB_URL;
  return (typeof fromVite === 'string' ? fromVite : '').trim();
}

function readLocalDbAnonKey(): string {
  if (typeof window !== 'undefined' && window.__ENV__?.VITE_LOCAL_DB_ANON_KEY) {
    const v = String(window.__ENV__.VITE_LOCAL_DB_ANON_KEY).trim();
    if (v) return v;
  }
  const fromVite = import.meta.env.VITE_LOCAL_DB_ANON_KEY;
  return (typeof fromVite === 'string' ? fromVite : '').trim();
}

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

/** true se URL + chave anon estao definidas (runtime ou Vite). */
export function isLocalFinanceDbConfigured(): boolean {
  return Boolean(readLocalDbUrl() && readLocalDbAnonKey());
}

function makeLocalClient(url: string, anonKey: string): SupabaseClient<LocalDatabase> {
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

  return createClient<LocalDatabase>(url, anonKey, {
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

let cachedClient: SupabaseClient<LocalDatabase> | null = null;
let cacheSig = '';

function getOrCreateLocalClient(): SupabaseClient<LocalDatabase> {
  const url = readLocalDbUrl();
  const key = readLocalDbAnonKey();
  const sig = `${url}\0${key}`;
  if (cachedClient && cacheSig === sig) {
    return cachedClient;
  }
  cacheSig = sig;
  cachedClient = url && key ? makeLocalClient(url, key) : makeDisabledFinanceClient();
  return cachedClient;
}

/**
 * Use apenas para: account_categories, financial_accounts, cash_flow_transactions,
 * financial_categories, financial_transactions, credit_cards, credit_card_invoices, RPC compute_invoice_for_card.
 */
export const localDb = new Proxy({} as SupabaseClient<LocalDatabase>, {
  get(_target, prop, receiver) {
    const client = getOrCreateLocalClient();
    const value = Reflect.get(client as object, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
}) as unknown as SupabaseClient;
