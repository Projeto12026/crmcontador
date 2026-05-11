#!/bin/sh
# Gera config.js a partir das variáveis de ambiente (EasyPanel injeta em runtime)
cat << EOF > /usr/share/nginx/html/config.js
window.__ENV__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY}",
  VITE_LOCAL_DB_URL: "${VITE_LOCAL_DB_URL}",
  VITE_LOCAL_DB_ANON_KEY: "${VITE_LOCAL_DB_ANON_KEY}"
};
EOF
exec nginx -g "daemon off;"
