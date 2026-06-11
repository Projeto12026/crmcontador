/**
 * Cliente PostgREST para o banco financeiro local (Postgres self-hosted).
 *
 * - Padrao em Docker/EasyPanel: usa o proxy same-origin /finance-rest do nginx do CRM.
 * - Se VITE_LOCAL_DB_URL estiver definida, usa essa URL publica (modo legado).
 * - NUNCA cai para o REST do Supabase para tabelas financeiras.
 *
 * Quando o usuario estiver logado no Supabase Auth, cada chamada deste cliente
 * envia automaticamente o access_token do Supabase como Authorization Bearer.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { LocalDatabase } from './types';

declare global {
  interface Window {
    __ENV__?: {
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_PUBLISHABLE_KEY?: string;
      VITE_LOCAL_DB_URL?: string;
      VITE_LOCAL_DB_ANON_KEY?: string;
      FINANCE_POSTGREST_URL?: string;
      FINANCE_POSTGREST_ANON_KEY?: string;
      LOCAL_DB_URL?: string;
      LOCAL_DB_ANON_KEY?: string;
      POSTGREST_URL?: string;
      POSTGREST_ANON_KEY?: string;
    };
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = (value || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function normalizePostgrestBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}

function readLocalDbUrl(): string {
  const env = typeof window !== 'undefined' ? window.__ENV__ : undefined;
  const explicit = firstNonEmpty(
    env?.VITE_LOCAL_DB_URL,
    env?.FINANCE_POSTGREST_URL,
    env?.LOCAL_DB_URL,
    env?.POSTGREST_URL,
    import.meta.env.VITE_LOCAL_DB_URL,
  );
  if (explicit) return normalizePostgrestBaseUrl(explicit);

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/finance-rest`;
  }

  return '';
}

function readLocalDbAnonKey(): string {
  const env = typeof window !== 'undefined' ? window.__ENV__ : undefined;
  return firstNonEmpty(
    env?.VITE_LOCAL_DB_ANON_KEY,
    env?.FINANCE_POSTGREST_ANON_KEY,
    env?.LOCAL_DB_ANON_KEY,
    env?.POSTGREST_ANON_KEY,
    import.meta.env.VITE_LOCAL_DB_ANON_KEY,
  );
}

export const LOCAL_DB_ENABLED = Boolean(readLocalDbUrl());

function makeDisabledFinanceResponse(): Response {
  return new Response(
    JSON.stringify({
      code: 'NO_LOCAL_FINANCE_DB',
      message:
        'Banco financeiro local indisponivel. Configure FINANCE_POSTGREST_UPSTREAM no CRM (proxy /finance-rest) ou VITE_LOCAL_DB_URL para PostgREST publico.',
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
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
      // Sem sessao: o supabase-js usa a apiKey como Authorization.
    }

    const headers = new Headers(init?.headers);
    for (const [k, v] of Object.entries(auth)) headers.set(k, v);

    return fetch(input, { ...init, headers });
  };

  return createClient<LocalDatabase>(url, anonKey || 'local-finance-proxy', {
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

let cachedClient: SupabaseClient<LocalDatabase> | null = null;
let cacheSignature = '';

function getOrCreateLocalClient(): SupabaseClient<LocalDatabase> {
  const url = readLocalDbUrl();
  const anonKey = readLocalDbAnonKey();
  const signature = `${url}\0${anonKey}`;

  if (cachedClient && cacheSignature === signature) {
    return cachedClient;
  }

  cacheSignature = signature;

  if (!url) {
    cachedClient = createClient<LocalDatabase>('https://local-finance.invalid', 'local-finance-placeholder', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async () => makeDisabledFinanceResponse() },
    });
    return cachedClient;
  }

  cachedClient = makeLocalClient(url, anonKey);
  return cachedClient;
}

/**
 * Cliente do banco financeiro local.
 *
 * IMPORTANTE: Use apenas para tabelas financeiras. Auth, clientes, contratos,
 * Cora e demais modulos continuam no Supabase principal.
 */
export const localDb = new Proxy({} as SupabaseClient<LocalDatabase>, {
  get(_target, prop, receiver) {
    const client = getOrCreateLocalClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as unknown as SupabaseClient;
