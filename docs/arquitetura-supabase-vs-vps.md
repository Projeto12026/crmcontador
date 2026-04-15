# Estudo de arquitetura: Supabase vs banco próprio na VPS

Documento de entrega do plano de análise (inventário, TCO, POC). **Não substitui decisão de negócio**; serve de base técnica para uma eventual migração.

---

## 1. Inventário de dependências (baseline do repositório)

### 1.1 Tabelas `public` (migrations)

| Área | Tabelas |
|------|---------|
| CRM core | `clients`, `client_contacts`, `tasks`, `leads`, `lead_activities` |
| Processos | `process_templates`, `process_template_steps`, `processes`, `process_steps` |
| Contratos | `contracts`, `contract_services` |
| Onboarding | `onboarding_templates`, `onboarding_template_items`, `client_onboarding`, `client_onboarding_items` |
| Financeiro (legado módulo) | `financial_categories`, `financial_transactions`, `settings` |
| Financeiro (Nescon / fluxo) | `account_categories`, `financial_accounts`, `cash_flow_transactions` |
| Folha | `payroll_obligations` |
| Precificação | `pricing_service_catalog`, `pricing_proposals`, `pricing_proposal_items` |
| Marketing | `marketing_investments` |
| Papéis | `user_roles` |
| Cora | `cora_empresas`, `cora_boletos`, `cora_envios`, `cora_config`, `cora_message_templates` |
| WhatsApp / sync (legado) | `empresas`, `whatsapp_config`, `message_templates`, `config`, `sync_log` |

**Total aproximado:** 35 tabelas em `public` (algumas podem ser legado paralelo ao fluxo atual).

### 1.2 Row Level Security (RLS)

- Várias migrations em `supabase/migrations/` aplicam `ENABLE ROW LEVEL SECURITY` e dezenas de `CREATE POLICY` (padrão “Authenticated users full access” ou políticas por equipa em `financial_accounts` / `cash_flow_transactions`).
- **Impacto de migração:** ao remover Supabase/PostgREST, essas regras deixam de ser aplicadas automaticamente no browser; precisam ser **replicadas na API** (autorização por perfil) ou via outro gateway com políticas equivalentes.

### 1.3 Edge Functions (Supabase)

| Função | Ficheiro | Uso no front / integração |
|--------|----------|---------------------------|
| `backup-data` | `supabase/functions/backup-data/index.ts` | `SettingsPage`, `useAutoBackup` |
| `sync-gclick-obligations` | `supabase/functions/sync-gclick-obligations/index.ts` | `usePayrollObligations` (G-Click) |
| `send-task-to-zapier` | `supabase/functions/send-task-to-zapier/index.ts` | `useTasks` (webhook Zapier em `settings.key`) |
| `receive-task-from-zapier` | `supabase/functions/receive-task-from-zapier/index.ts` | Entrada Zapier → tarefas |

**Impacto:** cada uma precisaria de **hospedagem alternativa** (mesmo Node na VPS, workers, etc.) e variáveis de ambiente equivalentes.

### 1.4 Integrações externas (fora do Postgres)

| Sistema | Onde |
|---------|------|
| **Supabase Auth + JWT** | `src/integrations/supabase/client.ts`, `useAuth` |
| **Cora (mTLS)** | `backend/cora-proxy` → `matls-clients.api.cora.com.br` |
| **Wascript (WhatsApp)** | `backend/cora-proxy` → API documento/texto |
| **G-Click** | Edge Function `sync-gclick-obligations` |
| **Zapier** | Edge Functions + `settings` (`zapier_webhook_url`) |
| **Backup REST** | `scripts/backup-supabase.js`, função `backup-data` |

### 1.5 Cliente da aplicação

- O React usa **`@supabase/supabase-js`** com **chave anon** e **sessão em `localStorage`** em dezenas de hooks/páginas (`supabase.from(...)`).
- O **cora-proxy** na VPS usa **`SUPABASE_SERVICE_ROLE_KEY`** (bypass RLS) para cron/sync.

---

## 2. Estimativa de TCO (custo total aproximado)

Valores são **ordens de grandeza** para planeamento; ajustar à realidade da equipa (PT/BR) e ao fornecedor VPS.

### 2.1 Manter Supabase (baseline)

| Item | Notas |
|------|--------|
| Licença / plano | Conforme uso (Free/Pro/Enterprise) |
| Operação | Baixa (managed) |
| Desenvolvimento incremental | Apenas features novas |

### 2.2 PostgreSQL na VPS + API + Auth (substituir stack Supabase no browser)

| Fase | Atividade | Esforço relativo |
|------|-----------|------------------|
| Desenho | Modelo de API, auth, mapeamento RLS → regras de negócio | M |
| Implementação | Endpoints para substituir chamadas `supabase.from` (muitas rotas) | **XL** |
| Auth | Sessões/JWT, reset password, alinhar `user_roles` | L–XL |
| Edge Functions | Reimplementar 4 fluxos + secrets | M |
| Dados | `pg_dump` / restore, testes de integridade, cutover | M |
| Operação VPS | Postgres (Docker/nativo), backups, TLS, updates | Contínuo (M/ano) |

**Risco:** regressões de segurança se a API não reproduzir corretamente o que o RLS fazia.

### 2.3 Self-hosted Supabase (open source na VPS)

| Item | Notas |
|------|--------|
| Dev front | Menor que “Postgres puro + API própria” (mantém padrão atual) |
| Ops | Superior a “só Postgres”: stack Supabase, upgrades, hardening |
| Custo fixo | VPS maior + tempo de administração |

### 2.4 Comparativo rápido

| Cenário | CAPEX (dev migração) | OPEX (mensal) | Risco |
|---------|----------------------|---------------|-------|
| Supabase gerido | Baixo | Plano Supabase | Baixo |
| Postgres VPS + API | **Alto** | VPS + tempo interno | Médio-alto |
| Self-hosted Supabase | Médio-alto | VPS + tempo interno | Médio |

**Regra prática:** só migrar por **soberania/custo** depois de quantificar **horas de dev + horas/mês de ops** frente à **economia real** no Supabase.

---

## 3. POC (prova de conceito) — fluxo ponta-a-ponta

Objetivo: validar **restauração do schema/dados** e o desenho **API + auth** sem alterar produção.

### 3.1 Artefactos no repositório

- [`docs/migration-poc/docker-compose.yml`](migration-poc/docker-compose.yml) — PostgreSQL 16 local isolado.
- [`docs/migration-poc/README.md`](migration-poc/README.md) — passos de dump/restore e checklist de API/auth.

### 3.2 Escopo mínimo sugerido do POC

1. Subir Postgres local (`docker compose` no diretório do POC).
2. `pg_dump` do projeto Supabase (schema + dados de homologação, **nunca** expor `service_role` em scripts públicos).
3. `psql` restore no container local.
4. (Opcional) Protótipo: **uma** rota HTTP `GET /api/clients` com JWT emitido por um stub (ex.: login fixo em dev) consultando o mesmo schema — prova latência e padrão de auth.

### 3.3 Critérios de sucesso do POC

- Restore sem erros de FK/extension.
- Lista de clientes idêntica à origem (contagem e amostra).
- Documento escrito: **lista de endpoints** necessários para substituir o uso atual do `supabase-js` (prioridade: auth, clients, contracts, cora_*).

---

## 4. Referência cruzada

- Plano original (metas e diagrama): ficheiro de plano “Estudo BD VPS vs Supabase” na pasta de planos do Cursor (não editado aqui).
- Código: `supabase/migrations/`, `supabase/functions/`, `src/integrations/supabase/`, `backend/cora-proxy/`.

---

*Gerado como entrega dos to-dos: inventário, TCO, POC.*
