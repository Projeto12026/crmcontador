#!/bin/sh
set -e
# Gera config.js a partir das variáveis de ambiente (EasyPanel injeta em runtime).
# Vários painéis não expõem nomes com prefixo VITE_ no container em execução — aceitamos sinônimos.

# URL do PostgREST (pública, sem /rest/v1 no final)
FINANCE_DB_URL="${VITE_LOCAL_DB_URL:-}"
[ -n "$FINANCE_DB_URL" ] || FINANCE_DB_URL="${FINANCE_POSTGREST_URL:-}"
[ -n "$FINANCE_DB_URL" ] || FINANCE_DB_URL="${LOCAL_DB_URL:-}"
[ -n "$FINANCE_DB_URL" ] || FINANCE_DB_URL="${POSTGREST_URL:-}"

# JWT anon (role anon), mesmo segredo PGRST_JWT_SECRET / Supabase
FINANCE_DB_ANON="${VITE_LOCAL_DB_ANON_KEY:-}"
[ -n "$FINANCE_DB_ANON" ] || FINANCE_DB_ANON="${FINANCE_POSTGREST_ANON_KEY:-}"
[ -n "$FINANCE_DB_ANON" ] || FINANCE_DB_ANON="${LOCAL_DB_ANON_KEY:-}"
[ -n "$FINANCE_DB_ANON" ] || FINANCE_DB_ANON="${POSTGREST_ANON_KEY:-}"

if [ -z "$FINANCE_DB_URL" ] || [ -z "$FINANCE_DB_ANON" ]; then
  echo "crmcontador: AVISO — URL ou chave do PostgREST financeiro vazia(s). O modulo financeiro ficara indisponivel." >&2
  echo "crmcontador: Defina no Environment do container (em execucao), nao so em build args: VITE_LOCAL_DB_URL + VITE_LOCAL_DB_ANON_KEY, ou FINANCE_POSTGREST_URL + FINANCE_POSTGREST_ANON_KEY, ou LOCAL_DB_URL + LOCAL_DB_ANON_KEY." >&2
  echo "crmcontador: O cliente Supabase no front tem URL/chave padrao embutidas — login/CRM podem funcionar mesmo assim." >&2
fi

cat << EOF > /usr/share/nginx/html/config.js
window.__ENV__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:-}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY:-}",
  VITE_LOCAL_DB_URL: "${FINANCE_DB_URL}",
  VITE_LOCAL_DB_ANON_KEY: "${FINANCE_DB_ANON}"
};
EOF
exec nginx -g "daemon off;"
