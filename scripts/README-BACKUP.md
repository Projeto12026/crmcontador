# Backup diário do banco Supabase na VPS

O script `backup-supabase.js` exporta **todas as tabelas** do sistema (CRM + Cora) via API REST do Supabase, mantendo apenas os **últimos 10** arquivos.

## Onde os backups são salvos (melhor lugar)

Por padrão os arquivos vão para um diretório **fora do repositório**, para não ser apagado em deploy:

| Ambiente | Caminho padrão |
|----------|----------------|
| **VPS (Linux)** | `$HOME/backups/supabase-crm/` (ex.: `/home/usuario/backups/supabase-crm/`) |
| **Windows** | `%USERPROFILE%\backups\supabase-crm\` |
| **Fallback** | `./backups/` na raiz do projeto |

Você pode sobrescrever com a variável **BACKUP_DIR** (ex.: `/var/backups/supabase-crm` na VPS, se tiver permissão).

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (ou configure no cron da VPS) com:

```env
SUPABASE_URL=https://njeldrgzkxiluwasiivp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZWxkcmd6a3hpbHV3YXNpaXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTE3MzEsImV4cCI6MjA4NjI2NzczMX0.mBjqo7J26tYvUT3vNkt7P-0yWxrYUVL07s2YKDyG5o0
SUPABASE_BACKUP_EMAIL=admin@admin.com
SUPABASE_BACKUP_PASSWORD=sua_senha_do_app
```

- **SUPABASE_BACKUP_EMAIL / SUPABASE_BACKUP_PASSWORD:** use o e-mail e a senha de um usuário do app com acesso aos dados (ex.: admin do Lovable).
- Opcional: **BACKUP_DIR** (caminho absoluto ou relativo ao projeto), **BACKUP_KEEP** (default: `10`).

## Executar manualmente

Na raiz do projeto (onde está o `package.json`):

```bash
# Carregar variáveis do .env (Linux/Mac)
export $(grep -v '^#' .env | xargs)
node scripts/backup-supabase.js
```

No Windows (PowerShell):

```powershell
Get-Content .env | ForEach-Object { if ($_ -match '^([^#][^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
node scripts/backup-supabase.js
```

## Cron Job no código (agendador em Node)

Você pode deixar o agendamento **dentro do projeto**, sem depender do cron do SO ou do EasyPanel:

1. Instale a dependência: `npm install`
2. Suba o agendador e mantenha o processo rodando (ex.: como serviço na VPS):

```bash
npm run backup:scheduler
```

Esse processo fica em execução e roda o backup **todo dia às 3h (horário de Brasília)**. O horário pode ser alterado com a variável **BACKUP_CRON_SCHEDULE** (formato cron: `minuto hora dia mês dia-semana`). Ex.: `BACKUP_CRON_SCHEDULE="0 4 * * *"` para 4h.

Para rodar um backup logo ao iniciar o agendador (útil para testar), defina **BACKUP_RUN_ON_START=1**.

No **EasyPanel**: crie um serviço que execute `npm run backup:scheduler` (ou `node scripts/backup-scheduler.js`) com as variáveis de ambiente do Supabase e deixe o serviço sempre ligado. Assim o Cron Job fica no código e não precisa configurar cron no painel.

---

## Agendar backup diário na VPS (cron do sistema)

1. Coloque as variáveis de ambiente em um arquivo (ex.: `~/backup.env` ou no `.env` do projeto na VPS).
2. Agende o script para rodar todo dia (ex.: 3h da manhã):

```bash
crontab -e

# Exemplo (ajuste o caminho do projeto e do .env):
0 3 * * * cd /caminho/para/crmcontador && set -a && . ./backup.env && set +a && node scripts/backup-supabase.js >> ~/backups/supabase-crm/backup.log 2>&1
```

Os arquivos de backup serão criados em `$HOME/backups/supabase-crm/` (ou no BACKUP_DIR que você definir).

No **EasyPanel** crie um **Cron Job** com o mesmo comando e defina as variáveis SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BACKUP_EMAIL e SUPABASE_BACKUP_PASSWORD no painel.

## O que é salvo

- Um arquivo JSON por execução: `backup-AAAA-MM-DDTHH-mm-ss.json` (no diretório definido acima).
- Cada arquivo contém um dump de todas as tabelas (clientes, contratos, Cora, financeiro, leads, processos, etc.).
- São mantidos apenas os **10 arquivos mais recentes**; os mais antigos são apagados automaticamente.

## Restaurar

Para restaurar a partir de um backup, seria necessário um script que leia o JSON e faça `insert` nas tabelas (ou use o Supabase Dashboard para importar manualmente). Se precisar, podemos criar um `restore-supabase.js` depois.
