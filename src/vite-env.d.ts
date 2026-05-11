/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** PostgREST publico do Postgres financeiro (obrigatorio para ler/gravar lancamentos, contas, cartoes). */
  readonly VITE_LOCAL_DB_URL?: string;
  /** JWT anon (role anon) assinado com o mesmo JWT_SECRET do Supabase, para o PostgREST. */
  readonly VITE_LOCAL_DB_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
