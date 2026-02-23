#!/usr/bin/env node
/**
 * Backup diário do banco Supabase (sistema completo) para a VPS.
 * Mantém apenas os últimos 10 backups.
 *
 * Uso: node scripts/backup-supabase.js
 * Requer: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BACKUP_EMAIL, SUPABASE_BACKUP_PASSWORD
 * Opcional: BACKUP_DIR (default: ./backups), BACKUP_KEEP (default: 10)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_BACKUP_EMAIL = process.env.SUPABASE_BACKUP_EMAIL;
const SUPABASE_BACKUP_PASSWORD = process.env.SUPABASE_BACKUP_PASSWORD;

// Melhor lugar para backup: fora do repositório, persistente na VPS (não é apagado em deploy)
const defaultBackupDir = (() => {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) return path.join(home, 'backups', 'supabase-crm');
  return path.join(projectRoot, 'backups');
})();
const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(projectRoot, process.env.BACKUP_DIR) : defaultBackupDir;
const BACKUP_KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP || '10', 10));

/** Todas as tabelas do schema public (sistema completo) */
const TABLES = [
  'account_categories',
  'cash_flow_transactions',
  'client_contacts',
  'client_onboarding',
  'client_onboarding_items',
  'clients',
  'contract_services',
  'contracts',
  'cora_boletos',
  'cora_config',
  'cora_empresas',
  'cora_envios',
  'cora_message_templates',
  'financial_accounts',
  'financial_categories',
  'financial_transactions',
  'lead_activities',
  'leads',
  'marketing_investments',
  'onboarding_template_items',
  'onboarding_templates',
  'payroll_obligations',
  'pricing_proposal_items',
  'pricing_proposals',
  'pricing_service_catalog',
  'process_steps',
  'process_template_steps',
  'process_templates',
  'processes',
  'settings',
  'tasks',
  'user_roles',
];

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log('ERRO: Defina SUPABASE_URL e SUPABASE_ANON_KEY');
    process.exit(1);
  }
  if (!SUPABASE_BACKUP_EMAIL || !SUPABASE_BACKUP_PASSWORD) {
    log('ERRO: Defina SUPABASE_BACKUP_EMAIL e SUPABASE_BACKUP_PASSWORD (usuário com acesso às tabelas)');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  log('Login no Supabase...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: SUPABASE_BACKUP_EMAIL,
    password: SUPABASE_BACKUP_PASSWORD,
  });
  if (authError) {
    log('ERRO no login: ' + authError.message);
    process.exit(1);
  }
  log('Login OK.');
  log('Diretório de backup: ' + BACKUP_DIR);

  const backup = { exportedAt: new Date().toISOString(), tables: {} };

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        log(`Aviso: ${table} - ${error.message}`);
        backup.tables[table] = { error: error.message, rows: [] };
        continue;
      }
      backup.tables[table] = { rows: data || [], count: (data || []).length };
      log(`${table}: ${(data || []).length} registro(s)`);
    } catch (e) {
      log(`Aviso: ${table} - ${e.message}`);
      backup.tables[table] = { error: e.message, rows: [] };
    }
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');
  log(`Backup salvo: ${filepath}`);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length > BACKUP_KEEP) {
    const toRemove = files.slice(BACKUP_KEEP);
    for (const f of toRemove) {
      fs.unlinkSync(f.path);
      log(`Removido backup antigo: ${f.name}`);
    }
  }

  log('Backup concluído. Total de arquivos mantidos: ' + Math.min(files.length, BACKUP_KEEP));
}

main().catch(err => {
  log('ERRO: ' + err.message);
  process.exit(1);
});
