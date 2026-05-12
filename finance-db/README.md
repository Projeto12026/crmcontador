# Banco Financeiro Local (Postgres + PostgREST no EasyPanel)

Este diretório contém tudo para mover **o módulo financeiro** do Supabase para um Postgres self-hosted na sua VPS Hostinger, mantendo o resto do app (Auth, clients, contracts, tasks, leads, processes, onboarding, gclick, cora, payroll) no Supabase.

## Arquivos

- `bootstrap.sql` — schema completo + funções + triggers + roles PostgREST + seed do plano de contas. Aplicar **uma vez** num banco vazio.
- `scripts/migrate-from-supabase.mjs` — copia os dados financeiros existentes do Supabase para o Postgres novo. Idempotente.
- `docker-compose.example.yml` — referência caso queira instalar fora do EasyPanel.

## Pré-requisitos

- EasyPanel rodando (mesmo onde está o `cora-proxy` hoje).
- Connection string PostgreSQL **direta** do Supabase (não a URL pública). Pegue em **Supabase Dashboard → Settings → Database → Connection string → URI** (modo "Session" funciona). Formato:
  ```
  postgresql://postgres:[YOUR-PASSWORD]@db.rvekakbpmkemgiwkkdok.supabase.co:5432/postgres
  ```
- JWT Secret do Supabase: **Settings → API → JWT Settings → JWT Secret**. Vai ser usado para o PostgREST validar os tokens emitidos pelo Supabase Auth.

---

## Passo 1 — Subir o Postgres no EasyPanel

1. EasyPanel → **Project** (o mesmo do `cora-proxy`) → **+ Service** → **App** → **From Template** → procure **PostgreSQL** (ou crie manualmente um App rodando `postgres:16-alpine`).
2. Configurar:
   - **Image**: `postgres:16-alpine`
   - **Environment**:
     ```
     POSTGRES_USER=postgres
     POSTGRES_PASSWORD=<senha-forte-aqui>
     POSTGRES_DB=crmcontador_finance
     ```
   - **Mount Volume**: `/var/lib/postgresql/data` (dado persistente). EasyPanel cria automaticamente.
   - **Port**: 5432 — exponha **apenas internamente** (não publique para a internet).
3. Deploy. Aguarde ficar "Running".

**Anote:**
- Host interno (EasyPanel mostra algo como `<project>_postgres`): `crmcontador_postgres`.
- Senha que você escolheu.

## Passo 2 — Aplicar o bootstrap.sql

1. No EasyPanel, abra o **Terminal** do container Postgres (ou conecte via `psql` se expuser a porta).
2. Cole todo o conteúdo de [`bootstrap.sql`](./bootstrap.sql) num arquivo `/tmp/bootstrap.sql` dentro do container e rode:

   ```bash
   psql -U postgres -d crmcontador_finance -f /tmp/bootstrap.sql
   ```

   Ou direto via heredoc (cole o SQL inteiro de uma vez):

   ```bash
   psql -U postgres -d crmcontador_finance
   ```

   E cole o SQL na sessão.

3. Validar:

   ```sql
   \dt public.*
   -- deve listar: account_categories, financial_accounts, cash_flow_transactions,
   --              financial_categories, financial_transactions,
   --              credit_cards, credit_card_invoices
   SELECT count(*) FROM public.account_categories;
   -- deve retornar 29 (o seed do plano de contas)
   ```

## Passo 3 — Subir o PostgREST no EasyPanel

PostgREST é o servidor REST que vai expor o Postgres para o frontend (mesma API que o `@supabase/supabase-js` espera).

1. EasyPanel → **+ Service** → **App** → **Custom Image**:
   - **Image**: `postgrest/postgrest:v12.0.2`
2. **Environment** (todos obrigatórios):

   ```
   PGRST_DB_URI=postgres://authenticator:<senha-do-authenticator>@crmcontador_postgres:5432/crmcontador_finance
   PGRST_DB_SCHEMAS=public
   PGRST_DB_ANON_ROLE=anon
   PGRST_JWT_SECRET=<JWT-Secret-DO-SUPABASE>
   PGRST_JWT_AUD=authenticated
   PGRST_SERVER_PORT=3000
   ```

   - `PGRST_JWT_SECRET` é o JWT Secret do **Supabase**. Assim o PostgREST aceita os tokens que o Supabase Auth já emite — usuário logado no app passa o mesmo token.
   - `<senha-do-authenticator>` é a senha que você vai criar no Passo 3.1.
3. **Port**: 3000 — exponha publicamente via domínio `finance.seudominio.com.br` (EasyPanel gerencia o TLS via Let's Encrypt automaticamente).
4. Deploy.

### Passo 3.1 — Criar a role authenticator

PostgREST precisa de um usuário Postgres com login que troca de role conforme o JWT. Criar:

```sql
-- Rodar uma vez no Postgres
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '<senha-do-authenticator>';
GRANT anon, authenticated TO authenticator;
```

(troque `<senha-do-authenticator>` pela mesma senha que está em `PGRST_DB_URI`).

## Passo 4 — Testar o PostgREST

```bash
curl https://finance.seudominio.com.br/account_categories?select=id,name&limit=3
# deve retornar JSON com 3 categorias
```

Se voltar `[]` ou erro 401: confira `PGRST_DB_ANON_ROLE=anon` e os `GRANT SELECT ON public.account_categories TO anon`.

## Passo 5 — Migrar os dados existentes

Do seu computador local (ou de dentro do EasyPanel via Console), rodar:

```bash
cd finance-db
npm install pg dotenv  # se ainda não tiver

# Variaveis necessarias
export SUPABASE_DB_URL='postgresql://postgres:SENHA@db.rvekakbpmkemgiwkkdok.supabase.co:5432/postgres'
export LOCAL_DB_URL='postgresql://postgres:SENHA@<host-publico-do-postgres>:5432/crmcontador_finance'

node scripts/migrate-from-supabase.mjs
```

O script:
- Lê tudo do Supabase nas tabelas: `account_categories`, `financial_accounts`, `cash_flow_transactions`, `financial_categories`, `financial_transactions`, `credit_cards`, `credit_card_invoices`.
- Insere no Postgres local com `INSERT ... ON CONFLICT DO NOTHING` (idempotente; pode rodar várias vezes sem duplicar).
- No fim imprime contagens antes/depois.

> O Postgres do EasyPanel normalmente não está exposto publicamente. Para essa cópia única, ou:
> - Exponha **temporariamente** a porta 5432 publicamente, roda o script, fecha de novo, ou
> - Suba o script DENTRO da própria VPS (via EasyPanel Console em um container Node, ou via SSH se você tiver), apontando para o host interno `crmcontador_postgres`.

## Passo 6 — Apontar o frontend para o Postgres local

No EasyPanel, no **App do frontend** (o `crmcontador_check`), adicionar variáveis de ambiente:

```
VITE_LOCAL_DB_URL=https://finance.seudominio.com.br
VITE_LOCAL_DB_ANON_KEY=<JWT-fixo-com-role-anon>
```

O `VITE_LOCAL_DB_ANON_KEY` é um JWT estático assinado com o `JWT_SECRET` do Supabase, com payload `{"role":"anon"}`. Gerar:

```bash
# Substituir <SECRET> pelo JWT Secret do Supabase
node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({ role: 'anon' }, '<SECRET>', { expiresIn: '10y' }));
"
```

Esse token é só pra requisições **anônimas** (antes do login). Quando o usuário faz login no app, o frontend envia automaticamente o `access_token` real do Supabase Auth, que tem `role: 'authenticated'` no payload — e o PostgREST vai aceitar.

Faça **redeploy** do app no EasyPanel para as variáveis subirem.

## Passo 7 — Checagem final

1. Abrir o app, fazer login.
2. Ir em Financeiro → conferir lançamentos, contas, cartões, faturas.
3. Criar um lançamento novo → ver no Postgres local:
   ```sql
   SELECT id, description, value, created_at FROM cash_flow_transactions ORDER BY created_at DESC LIMIT 3;
   ```
4. Confirmar que o Supabase **não** recebeu o novo lançamento (módulo financeiro saiu de lá).

## Rollback (se algo der errado)

Reverter o frontend é trivial: remover/zerar `VITE_LOCAL_DB_URL` e redeploy. O código tem fallback: se a URL local estiver vazia, ele continua usando o cliente Supabase. Os lançamentos novos criados no Postgres local podem ser exportados de volta (script reverso fica como exercício; só você fica sabendo o que rolou no Postgres novo).

## Backup do banco financeiro

`pg_dump` diário recomendado. Adicione um **Cron Job** no EasyPanel rodando dentro do container Postgres:

```bash
0 3 * * *  pg_dump -U postgres -d crmcontador_finance | gzip > /var/lib/postgresql/data/backups/finance-$(date +\%F).sql.gz
```

E retenção:

```bash
find /var/lib/postgresql/data/backups -name 'finance-*.sql.gz' -mtime +14 -delete
```
