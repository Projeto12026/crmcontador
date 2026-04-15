# POC migração: Postgres local

Objetivo: validar **backup/restore** e preparar terreno para uma futura **API + auth** sem tocar no Supabase de produção.

## Pré-requisitos

- Docker / Docker Compose
- `pg_dump` / `psql` (cliente PostgreSQL) na máquina de desenvolvimento
- Acesso ao projeto Supabase com permissão para **dump** (idealmente ambiente de **homologação**)

## 1. Subir o Postgres do POC

```bash
cd docs/migration-poc
docker compose up -d
```

Conexão local: `postgresql://poc:poc_local_only_change_me@localhost:5433/crm_poc`

## 2. Dump a partir do Supabase (exemplo)

Na máquina com acesso à rede do Supabase (não commitar passwords):

```bash
# Schema + dados (ajustar host conforme painel Supabase → Database → connection string)
pg_dump "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres" \
  --no-owner --no-acl -F c -f supabase_homolog.dump
```

Ou formato SQL:

```bash
pg_dump "...connection string..." --no-owner --no-acl -f supabase_homolog.sql
```

## 3. Restore no container POC

**Formato custom (`-F c`):**

```bash
pg_restore -h localhost -p 5433 -U poc -d crm_poc --no-owner --no-acl supabase_homolog.dump
```

**SQL:**

```bash
psql -h localhost -p 5433 -U poc -d crm_poc -f supabase_homolog.sql
```

Se falhar por extensões (`auth`, `storage`): o POC pode usar `pg_dump` **apenas schema `public`** para simplificar:

```bash
pg_dump "...conn..." -n public --no-owner --no-acl -f public_only.sql
```

## 4. Verificação mínima

```bash
psql -h localhost -p 5433 -U poc -d crm_poc -c "SELECT count(*) FROM public.clients;"
```

Comparar contagens com o ambiente de origem.

## 5. Próximo passo (fora deste POC)

- Implementar **um** serviço HTTP (Node/Fastify ou similar) com:
  - Conexão ao Postgres via utilizador de aplicação (não superuser)
  - **JWT** ou sessão após login (substituir GoTrue)
  - Rota `GET /clients` que replica a política desejada (ex.: só utilizadores autenticados)
- O front React deixaria de usar `supabase.from('clients')` e passaria a `fetch('/api/clients', { headers: { Authorization: 'Bearer ...' } })`.

## Segurança

- Não usar passwords reais em repositório.
- A password `poc_local_only_change_me` é só para máquina local.
- Apagar o volume Docker após testes: `docker compose down -v`.
