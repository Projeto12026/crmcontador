#!/bin/sh
# Gera config.js a partir das variáveis de ambiente (EasyPanel injeta em runtime)
cat << EOF > /usr/share/nginx/html/config.js
window.__ENV__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY}"
};
EOF
exec nginx -g "daemon off;"
