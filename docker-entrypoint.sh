#!/bin/sh
set -e

trim_trailing_slashes() {
  printf '%s' "$1" | sed 's#/*$##'
}

ensure_scheme() {
  case "$1" in
    http://*|https://*) printf '%s' "$1" ;;
    "") printf '' ;;
    *) printf 'http://%s' "$1" ;;
  esac
}

FINANCE_PROXY_UPSTREAM="${FINANCE_POSTGREST_UPSTREAM:-}"
[ -n "$FINANCE_PROXY_UPSTREAM" ] || FINANCE_PROXY_UPSTREAM="${FINANCE_POSTGREST_INTERNAL_URL:-}"
[ -n "$FINANCE_PROXY_UPSTREAM" ] || FINANCE_PROXY_UPSTREAM="${LOCAL_POSTGREST_UPSTREAM:-}"
[ -n "$FINANCE_PROXY_UPSTREAM" ] || FINANCE_PROXY_UPSTREAM="${POSTGREST_UPSTREAM:-}"

if [ -n "$FINANCE_PROXY_UPSTREAM" ]; then
  FINANCE_PROXY_UPSTREAM="$(ensure_scheme "$(trim_trailing_slashes "$FINANCE_PROXY_UPSTREAM")")"
fi

FINANCE_PUBLIC_DB_URL="${VITE_LOCAL_DB_URL:-}"
[ -n "$FINANCE_PUBLIC_DB_URL" ] || FINANCE_PUBLIC_DB_URL="${FINANCE_POSTGREST_URL:-}"
[ -n "$FINANCE_PUBLIC_DB_URL" ] || FINANCE_PUBLIC_DB_URL="${LOCAL_DB_URL:-}"
[ -n "$FINANCE_PUBLIC_DB_URL" ] || FINANCE_PUBLIC_DB_URL="${POSTGREST_URL:-}"
FINANCE_PUBLIC_DB_URL="$(trim_trailing_slashes "$FINANCE_PUBLIC_DB_URL")"

FINANCE_DB_ANON="${VITE_LOCAL_DB_ANON_KEY:-}"
[ -n "$FINANCE_DB_ANON" ] || FINANCE_DB_ANON="${FINANCE_POSTGREST_ANON_KEY:-}"
[ -n "$FINANCE_DB_ANON" ] || FINANCE_DB_ANON="${LOCAL_DB_ANON_KEY:-}"
[ -n "$FINANCE_DB_ANON" ] || FINANCE_DB_ANON="${POSTGREST_ANON_KEY:-}"

if [ -n "$FINANCE_PROXY_UPSTREAM" ]; then
  echo "crmcontador: /finance-rest -> ${FINANCE_PROXY_UPSTREAM}" >&2
  FINANCE_PROXY_BLOCK="
    location /finance-rest/rest/v1/ {
        proxy_pass ${FINANCE_PROXY_UPSTREAM}/;
        proxy_http_version 1.1;
        proxy_set_header Authorization \$http_authorization;
        proxy_set_header apikey \$http_apikey;
        proxy_set_header Host \$proxy_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_ssl_server_name on;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    location /finance-rest/ {
        default_type application/json;
        add_header Cache-Control \"no-store\";
        return 404 '{\"code\":\"FINANCE_PROXY_BAD_PATH\",\"message\":\"Use /finance-rest/rest/v1 para chamadas PostgREST.\"}';
    }"
else
  echo "crmcontador: AVISO - FINANCE_POSTGREST_UPSTREAM vazio. /finance-rest retornara 503." >&2
  FINANCE_PROXY_BLOCK="
    location /finance-rest/ {
        default_type application/json;
        add_header Cache-Control \"no-store\";
        return 503 '{\"code\":\"FINANCE_PROXY_NOT_CONFIGURED\",\"message\":\"Defina FINANCE_POSTGREST_UPSTREAM no servico Docker do CRM em execucao.\"}';
    }"
fi

cat << EOF > /usr/share/nginx/html/config.js
window.__ENV__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:-}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY:-}",
  VITE_LOCAL_DB_URL: "${FINANCE_PUBLIC_DB_URL}",
  VITE_LOCAL_DB_ANON_KEY: "${FINANCE_DB_ANON}"
};
EOF

cat << EOF > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location = /config.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        add_header Pragma "no-cache";
        try_files \$uri =404;
    }

${FINANCE_PROXY_BLOCK}

    location /api/ {
        proxy_pass http://cora-proxy:80/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
}
EOF

exec nginx -g "daemon off;"
