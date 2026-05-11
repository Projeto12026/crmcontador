#!/bin/sh
set -e
# Gera config.js a partir das variáveis de ambiente (EasyPanel injeta em runtime)
if [ -z "${VITE_LOCAL_DB_URL:-}" ] || [ -z "${VITE_LOCAL_DB_ANON_KEY:-}" ]; then
  echo "crmcontador: AVISO — VITE_LOCAL_DB_URL ou VITE_LOCAL_DB_ANON_KEY vazio(s). O modulo financeiro ficara indisponivel. O cliente Supabase no front tem URL/chave padrao embutidas, por isso login/CRM podem funcionar mesmo sem env no painel." >&2
fi
cat << EOF > /usr/share/nginx/html/config.js
window.__ENV__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:-}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY:-}",
  VITE_LOCAL_DB_URL: "${VITE_LOCAL_DB_URL:-}",
  VITE_LOCAL_DB_ANON_KEY: "${VITE_LOCAL_DB_ANON_KEY:-}"
};
EOF
exec nginx -g "daemon off;"
