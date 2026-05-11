/**
 * Cliente PostgREST para o banco financeiro local (Postgres self-hosted).
 *
 * - Se VITE_LOCAL_DB_URL estiver definida, aponta para o PostgREST proprio.
 * - Se NAO estiver definida, exporta o mesmo `supabase` original (fallback
 *   transparente — uti durante a transicao para nao quebrar o app).
 *
 * Quando o usuario estiver logado no Supabase Auth, cada chamada deste cliente
 * envia automaticamente o access_token do Supabase como Authorization Bearer
 * (intercepta via customFetch). O PostgREST aceita esse token desde que o
 * `JWT_SECRET` configurado seja igual ao do Supabase.
 *
 * Para chamadas sem login, o supabase-js usa o apiKey passado como `anonKey`
 * — que deve ser um JWT estatico assinado com o mesmo JWT_SECRET, payload
 * `{ role: 'anon' }`.
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
    };
  }
}

const LOCAL_DB_URL =
  (typeof window !== 'undefined' && window.__ENV__?.VITE_LOCAL_DB_URL) ||
  import.meta.env.VITE_LOCAL_DB_URL ||
  '';

const LOCAL_DB_ANON_KEY =
  (typeof window !== 'undefined' && window.__ENV__?.VITE_LOCAL_DB_ANON_KEY) ||
  import.meta.env.VITE_LOCAL_DB_ANON_KEY ||
  '';

/**
 * Indica se o backend local esta configurado.
 * Se false, `localDb` reaproveita o cliente Supabase (fallback).
 */
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
      // sem sessao -> usa apikey anon (Authorization padrao do supabase-js)
    }

    const headers = new Headers(init?.headers);
    for (const [k, v] of Object.entries(auth)) headers.set(k, v);

    return fetch(input, { ...init, headers });
  };

  return createClient<LocalDatabase>(LOCAL_DB_URL, LOCAL_DB_ANON_KEY, {
    auth: {
      // Auth fica no Supabase principal — local nao gerencia sessoes
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: customFetch,
    },
  });
}

/**
 * Cliente do banco financeiro local.
 * Se LOCAL_DB_ENABLED for false, e o proprio `supabase` (fallback transparente).
 *
 * IMPORTANTE: Use APENAS para as 7 tabelas financeiras:
 *   - account_categories
 *   - financial_accounts
 *   - cash_flow_transactions
 *   - financial_categories
 *   - financial_transactions
 *   - credit_cards
 *   - credit_card_invoices
 * E para a funcao RPC `compute_invoice_for_card`.
 */
export const localDb: SupabaseClient = LOCAL_DB_ENABLED
  ? (makeLocalClient() as unknown as SupabaseClient)
  : (supabase as unknown as SupabaseClient);
