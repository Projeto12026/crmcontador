#!/usr/bin/env node
/**
 * Agendador de backup diário (Cron Job no código).
 * Fica em execução e roda o backup Supabase todo dia no horário definido.
 *
 * Uso: node scripts/backup-scheduler.js
 * Requer as mesmas variáveis do backup: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BACKUP_EMAIL, SUPABASE_BACKUP_PASSWORD
 * Opcional: BACKUP_CRON_SCHEDULE (padrão: "0 3 * * *" = todo dia às 3h)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupScript = path.join(__dirname, 'backup-supabase.js');

// Formato cron: minuto hora dia-mês mês dia-semana (0 3 * * * = 3h da manhã todo dia)
const CRON_SCHEDULE = process.env.BACKUP_CRON_SCHEDULE || '0 3 * * *';

let cron;
try {
  cron = (await import('node-cron')).default;
} catch {
  console.error('Instale node-cron: npm install node-cron');
  process.exit(1);
}

function runBackup() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Iniciando backup agendado...`);
  const child = spawn(process.execPath, [backupScript], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.resolve(__dirname, '..'),
  });
  child.on('close', (code) => {
    const ts2 = new Date().toISOString();
    if (code === 0) {
      console.log(`[${ts2}] Backup agendado concluído.`);
    } else {
      console.error(`[${ts2}] Backup agendado saiu com código ${code}.`);
    }
  });
}

if (!cron.validate(CRON_SCHEDULE)) {
  console.error('BACKUP_CRON_SCHEDULE inválido:', CRON_SCHEDULE);
  process.exit(1);
}

cron.schedule(CRON_SCHEDULE, runBackup, { timezone: 'America/Sao_Paulo' });

console.log('Agendador de backup ativo. Próximo backup:', CRON_SCHEDULE, '(horário Brasília).');
console.log('Mantenha este processo em execução (ex.: em um serviço na VPS).');

// Opcional: rodar um backup imediatamente ao subir (útil para testar)
if (process.env.BACKUP_RUN_ON_START === '1') {
  console.log('BACKUP_RUN_ON_START=1: executando backup agora...');
  runBackup();
}
