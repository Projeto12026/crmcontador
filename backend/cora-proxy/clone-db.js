/**
 * Clone SQLite: espelho dos dados Cora para automação (leitura/escrita).
 * Uso: sync Supabase → Clone; run-scheduled-sends lê/escreve no clone.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const CLONE_DB_PATH = process.env.CLONE_DB_PATH || path.join(process.cwd(), 'data', 'cora-clone.db');

let db = null;

function getDb() {
  if (db) return db;
  const dir = path.dirname(CLONE_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(CLONE_DB_PATH);
  db.pragma('journal_mode = WAL');
  initSchema(db);
  ensureGclickDefaults(db);
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS cora_empresas (
      id TEXT PRIMARY KEY,
      client_name TEXT,
      cnpj TEXT NOT NULL,
      telefone TEXT,
      dia_vencimento INTEGER DEFAULT 15,
      valor_mensal REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cora_boletos (
      id TEXT PRIMARY KEY,
      cora_invoice_id TEXT NOT NULL UNIQUE,
      empresa_id TEXT,
      cnpj TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      total_amount_cents INTEGER DEFAULT 0,
      due_date TEXT,
      paid_at TEXT,
      competencia_mes INTEGER,
      competencia_ano INTEGER,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cora_boletos_empresa ON cora_boletos(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_cora_boletos_status ON cora_boletos(status);
    CREATE INDEX IF NOT EXISTS idx_cora_boletos_invoice ON cora_boletos(cora_invoice_id);

    CREATE TABLE IF NOT EXISTS cora_message_templates (
      id TEXT PRIMARY KEY,
      template_key TEXT NOT NULL,
      message_body TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cora_config (
      chave TEXT PRIMARY KEY,
      valor TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cora_envios (
      id TEXT PRIMARY KEY,
      empresa_id TEXT,
      boleto_id TEXT,
      competencia_mes INTEGER,
      competencia_ano INTEGER,
      canal TEXT,
      sucesso INTEGER DEFAULT 0,
      detalhe TEXT,
      tipo_envio TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cora_envios_dedup ON cora_envios(empresa_id, competencia_mes, competencia_ano, tipo_envio);

    CREATE TABLE IF NOT EXISTS gclick_clients (
      id TEXT PRIMARY KEY,
      name TEXT,
      document TEXT,
      phone TEXT,
      envia_via_gclick INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_gclick_clients_doc ON gclick_clients(document);

    CREATE TABLE IF NOT EXISTS gclick_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS gclick_sync_config (
      id TEXT PRIMARY KEY,
      is_enabled INTEGER DEFAULT 0,
      ask_send_confirmation_on_sync INTEGER DEFAULT 0,
      run_mode TEXT DEFAULT 'sync_only',
      interval_minutes INTEGER DEFAULT 5,
      competencia_mes INTEGER,
      competencia_ano INTEGER,
      match_patterns TEXT,
      last_run_at TEXT,
      last_run_error TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS gclick_guide_jobs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_document TEXT,
      guide_type TEXT NOT NULL,
      competencia_mes INTEGER NOT NULL,
      competencia_ano INTEGER NOT NULL,
      task_id TEXT,
      atividade_id TEXT,
      arquivo_nome TEXT,
      arquivo_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'FOUND',
      attempts INTEGER DEFAULT 0,
      sent_at TEXT,
      last_error TEXT,
      UNIQUE(client_id, guide_type, competencia_mes, competencia_ano, arquivo_url)
    );
    CREATE INDEX IF NOT EXISTS idx_gclick_jobs_comp ON gclick_guide_jobs(competencia_mes, competencia_ano);
    CREATE INDEX IF NOT EXISTS idx_gclick_jobs_status ON gclick_guide_jobs(status);
  `);
}

const DEFAULT_GCLICK_MATCH_PATTERNS = {
  INSS: ['inss', 'gps', 'previdencia'],
  FGTS: ['fgts', 'sefip', 'grf'],
};

function ensureGclickDefaults(database) {
  const row = database.prepare('SELECT id FROM gclick_sync_config LIMIT 1').get();
  if (row) return;
  const now = new Date();
  database.prepare(`
    INSERT INTO gclick_sync_config (
      id, is_enabled, ask_send_confirmation_on_sync, run_mode, interval_minutes,
      competencia_mes, competencia_ano, match_patterns, last_run_at, last_run_error, updated_at
    ) VALUES (?, 0, 0, 'sync_only', 5, ?, ?, ?, NULL, NULL, ?)
  `).run(
    'default',
    now.getMonth() + 1,
    now.getFullYear(),
    JSON.stringify(DEFAULT_GCLICK_MATCH_PATTERNS),
    now.toISOString(),
  );
}

export function initSchemaIfNeeded() {
  getDb();
}

export function getEmpresas() {
  const database = getDb();
  const rows = database.prepare('SELECT id, client_name, cnpj, telefone, dia_vencimento, valor_mensal, is_active FROM cora_empresas WHERE is_active = 1').all();
  return rows.map((r) => ({
    id: r.id,
    client_name: r.client_name,
    cnpj: r.cnpj,
    telefone: r.telefone,
    dia_vencimento: r.dia_vencimento,
    valor_mensal: r.valor_mensal,
    is_active: r.is_active,
  }));
}

export function getBoletos(statusFilter = null) {
  const database = getDb();
  let sql = 'SELECT id, empresa_id, cora_invoice_id, status, due_date, competencia_mes, competencia_ano, total_amount_cents FROM cora_boletos';
  const params = [];
  if (statusFilter && statusFilter.length) {
    sql += ' WHERE status IN (' + statusFilter.map(() => '?').join(',') + ')';
    params.push(...statusFilter);
  }
  const rows = database.prepare(sql).all(...params);
  return rows.map((r) => ({
    id: r.id,
    empresa_id: r.empresa_id,
    cora_invoice_id: r.cora_invoice_id,
    status: r.status,
    due_date: r.due_date,
    competencia_mes: r.competencia_mes,
    competencia_ano: r.competencia_ano,
    total_amount_cents: r.total_amount_cents,
  }));
}

export function getTemplates() {
  const database = getDb();
  return database.prepare('SELECT id, template_key, message_body, is_active FROM cora_message_templates WHERE is_active = 1').all();
}

export function getConfig(chave) {
  const database = getDb();
  const row = database.prepare('SELECT chave, valor FROM cora_config WHERE chave = ?').get(chave);
  if (!row) return null;
  try {
    return { chave: row.chave, valor: row.valor ? JSON.parse(row.valor) : null };
  } catch {
    return { chave: row.chave, valor: null };
  }
}

export function getEnvios() {
  const database = getDb();
  return database.prepare('SELECT empresa_id, competencia_mes, competencia_ano, tipo_envio, sucesso FROM cora_envios').all();
}

export function insertEnvio(envio) {
  const database = getDb();
  const id = envio.id || crypto.randomUUID();
  database.prepare(`
    INSERT INTO cora_envios (id, empresa_id, boleto_id, competencia_mes, competencia_ano, canal, sucesso, detalhe, tipo_envio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    envio.empresa_id ?? null,
    envio.boleto_id ?? null,
    envio.competencia_mes ?? null,
    envio.competencia_ano ?? null,
    envio.canal ?? 'WHATSAPP',
    envio.sucesso ? 1 : 0,
    envio.detalhe ?? null,
    envio.tipo_envio ?? null
  );
  return id;
}

export function upsertBoletos(items) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO cora_boletos (id, cora_invoice_id, empresa_id, cnpj, status, total_amount_cents, due_date, paid_at, competencia_mes, competencia_ano, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cora_invoice_id) DO UPDATE SET
      empresa_id = excluded.empresa_id,
      cnpj = excluded.cnpj,
      status = excluded.status,
      total_amount_cents = excluded.total_amount_cents,
      due_date = excluded.due_date,
      paid_at = excluded.paid_at,
      competencia_mes = excluded.competencia_mes,
      competencia_ano = excluded.competencia_ano,
      synced_at = excluded.synced_at
  `);
  const now = new Date().toISOString();
  for (const b of items) {
    const id = b.id || crypto.randomUUID();
    stmt.run(
      id,
      b.cora_invoice_id,
      b.empresa_id ?? null,
      b.cnpj ?? '',
      b.status ?? 'OPEN',
      b.total_amount_cents ?? 0,
      b.due_date ?? null,
      b.paid_at ?? null,
      b.competencia_mes ?? null,
      b.competencia_ano ?? null,
      b.synced_at ?? now
    );
  }
}

// ── GClick (SQLite local na VPS) ─────────────────────────────────

export function getGclickClients(onlyEnabled) {
  const database = getDb();
  let sql = 'SELECT id, name, document, phone, envia_via_gclick FROM gclick_clients';
  if (onlyEnabled) sql += ' WHERE envia_via_gclick = 1';
  const rows = database.prepare(sql).all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    document: r.document,
    phone: r.phone,
    envia_via_gclick: Boolean(r.envia_via_gclick),
  }));
}

export function listGclickGuideJobsForCompetencia(competenciaMes, competenciaAno) {
  const database = getDb();
  return database.prepare(`
    SELECT id, client_id, guide_type, competencia_mes, competencia_ano, arquivo_url, status, sent_at, attempts
    FROM gclick_guide_jobs
    WHERE competencia_mes = ? AND competencia_ano = ?
  `).all(competenciaMes, competenciaAno);
}

export function upsertGclickGuideJobs(items) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO gclick_guide_jobs (
      id, client_id, client_document, guide_type, competencia_mes, competencia_ano,
      task_id, atividade_id, arquivo_nome, arquivo_url, status, attempts, sent_at, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id, guide_type, competencia_mes, competencia_ano, arquivo_url) DO UPDATE SET
      client_document = excluded.client_document,
      task_id = excluded.task_id,
      atividade_id = excluded.atividade_id,
      arquivo_nome = excluded.arquivo_nome,
      status = CASE WHEN gclick_guide_jobs.status = 'SENT' THEN gclick_guide_jobs.status ELSE excluded.status END,
      sent_at = CASE WHEN gclick_guide_jobs.status = 'SENT' THEN gclick_guide_jobs.sent_at ELSE excluded.sent_at END,
      attempts = CASE WHEN gclick_guide_jobs.status = 'SENT' THEN gclick_guide_jobs.attempts ELSE excluded.attempts END,
      last_error = CASE WHEN gclick_guide_jobs.status = 'SENT' THEN gclick_guide_jobs.last_error ELSE excluded.last_error END
  `);
  for (const j of items) {
    const id = j.id || crypto.randomUUID();
    stmt.run(
      id,
      j.client_id,
      j.client_document ?? null,
      j.guide_type,
      j.competencia_mes,
      j.competencia_ano,
      j.task_id ?? null,
      j.atividade_id ?? null,
      j.arquivo_nome ?? null,
      j.arquivo_url,
      j.status ?? 'FOUND',
      Number(j.attempts || 0),
      j.sent_at ?? null,
      j.last_error ?? null,
    );
  }
}

export function listGclickJobsForSend({ competenciaMes, competenciaAno, jobIds = null, sendAll = false }) {
  const database = getDb();
  let sql = `
    SELECT j.id, j.client_id, j.client_document, j.guide_type, j.competencia_mes, j.competencia_ano,
           j.arquivo_nome, j.arquivo_url, j.status, j.attempts,
           c.name AS client_name, c.phone AS client_phone, c.envia_via_gclick AS client_envia
    FROM gclick_guide_jobs j
    LEFT JOIN gclick_clients c ON c.id = j.client_id
    WHERE j.competencia_mes = ? AND j.competencia_ano = ?
  `;
  const params = [competenciaMes, competenciaAno];
  if (!sendAll && Array.isArray(jobIds) && jobIds.length) {
    sql += ` AND j.id IN (${jobIds.map(() => '?').join(',')})`;
    params.push(...jobIds);
  }
  const rows = database.prepare(sql).all(...params);
  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    client_document: r.client_document,
    guide_type: r.guide_type,
    competencia_mes: r.competencia_mes,
    competencia_ano: r.competencia_ano,
    arquivo_nome: r.arquivo_nome,
    arquivo_url: r.arquivo_url,
    status: r.status,
    attempts: r.attempts,
    clients: {
      id: r.client_id,
      name: r.client_name,
      phone: r.client_phone,
      envia_via_gclick: r.client_envia == null ? true : Boolean(r.client_envia),
    },
  }));
}

export function updateGclickJob(id, fields) {
  const database = getDb();
  const cols = [];
  const vals = [];
  if (fields.status !== undefined) { cols.push('status = ?'); vals.push(fields.status); }
  if (fields.attempts !== undefined) { cols.push('attempts = ?'); vals.push(fields.attempts); }
  if (fields.last_error !== undefined) { cols.push('last_error = ?'); vals.push(fields.last_error); }
  if (fields.sent_at !== undefined) { cols.push('sent_at = ?'); vals.push(fields.sent_at); }
  if (!cols.length) return;
  vals.push(id);
  database.prepare(`UPDATE gclick_guide_jobs SET ${cols.join(', ')} WHERE id = ?`).run(...vals);
}

export function getGclickSyncConfigMerged(forcedMes, forcedAno) {
  const database = getDb();
  const row = database.prepare(`
    SELECT * FROM gclick_sync_config
    ORDER BY (updated_at IS NULL), updated_at DESC, last_run_at DESC
    LIMIT 1
  `).get();
  const now = new Date();
  const defaults = {
    id: 'default',
    is_enabled: false,
    ask_send_confirmation_on_sync: false,
    run_mode: 'sync_only',
    interval_minutes: 5,
    competencia_mes: now.getMonth() + 1,
    competencia_ano: now.getFullYear(),
    match_patterns: { ...DEFAULT_GCLICK_MATCH_PATTERNS },
    last_run_at: null,
    last_run_error: null,
  };
  let mp = defaults.match_patterns;
  if (row?.match_patterns) {
    try {
      const parsed = JSON.parse(row.match_patterns);
      if (parsed && typeof parsed === 'object') mp = { ...DEFAULT_GCLICK_MATCH_PATTERNS, ...parsed };
    } catch { /* ignore */ }
  }
  const base = row
    ? {
        id: row.id,
        is_enabled: Boolean(row.is_enabled),
        ask_send_confirmation_on_sync: Boolean(row.ask_send_confirmation_on_sync),
        run_mode: row.run_mode || 'sync_only',
        interval_minutes: Math.max(5, Number(row.interval_minutes || 5)),
        competencia_mes: row.competencia_mes ?? defaults.competencia_mes,
        competencia_ano: row.competencia_ano ?? defaults.competencia_ano,
        match_patterns: mp,
        last_run_at: row.last_run_at || null,
        last_run_error: row.last_run_error || null,
      }
    : { ...defaults, match_patterns: mp };

  return {
    ...base,
    competencia_mes: forcedMes || base.competencia_mes,
    competencia_ano: forcedAno || base.competencia_ano,
    interval_minutes: Math.max(5, Number(base.interval_minutes || 5)),
  };
}

export function updateGclickSyncConfigTelemetry(configId, { last_run_at, last_run_error }) {
  const database = getDb();
  const id = configId || 'default';
  const now = new Date().toISOString();
  database.prepare(`
    UPDATE gclick_sync_config
    SET last_run_at = ?, last_run_error = ?, updated_at = ?
    WHERE id = ?
  `).run(last_run_at ?? null, last_run_error ?? null, now, id);
}

export function getGclickSettingJson(key) {
  const database = getDb();
  const row = database.prepare('SELECT value FROM gclick_settings WHERE key = ?').get(key);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

// ── Sync from Supabase: replace tables with data from Supabase ──
export function syncFromSupabase(supabase) {
  const database = getDb();
  const counts = {
    empresas: 0, boletos: 0, templates: 0, config: 0, envios: 0,
    gclick_clients: 0, gclick_sync_config: 0, gclick_settings: 0,
  };

  return Promise.all([
    supabase.from('cora_empresas').select('id, client_name, cnpj, telefone, dia_vencimento, valor_mensal, is_active, updated_at'),
    supabase.from('cora_boletos').select('id, cora_invoice_id, empresa_id, cnpj, status, total_amount_cents, due_date, paid_at, competencia_mes, competencia_ano, synced_at'),
    supabase.from('cora_message_templates').select('id, template_key, message_body, is_active'),
    supabase.from('cora_config').select('chave, valor, updated_at'),
    supabase.from('cora_envios').select('id, empresa_id, boleto_id, competencia_mes, competencia_ano, canal, sucesso, detalhe, tipo_envio, created_at'),
    supabase.from('clients').select('id, name, document, phone, envia_via_gclick'),
    supabase.from('gclick_sync_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('settings').select('key, value').eq('key', 'gclick_credentials').maybeSingle(),
  ]).then(async ([r1, r2, r3, r4, r5, r6, r7, r8]) => {
    const empresas = r1.data || [];
    const boletos = r2.data || [];
    const templates = r3.data || [];
    const configs = r4.data || [];
    const envios = r5.data || [];
    const gClients = r6.data || [];
    const gCfg = r7.data;
    const gCred = r8.data;

    database.exec('BEGIN');
    try {
      database.prepare('DELETE FROM cora_empresas').run();
      const insEmp = database.prepare(`
        INSERT INTO cora_empresas (id, client_name, cnpj, telefone, dia_vencimento, valor_mensal, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const e of empresas) {
        insEmp.run(e.id, e.client_name ?? null, e.cnpj ?? '', e.telefone ?? null, e.dia_vencimento ?? 15, e.valor_mensal ?? 0, e.is_active ? 1 : 0, e.updated_at ?? null);
      }
      counts.empresas = empresas.length;

      database.prepare('DELETE FROM cora_boletos').run();
      const insBol = database.prepare(`
        INSERT INTO cora_boletos (id, cora_invoice_id, empresa_id, cnpj, status, total_amount_cents, due_date, paid_at, competencia_mes, competencia_ano, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const b of boletos) {
        insBol.run(b.id, b.cora_invoice_id, b.empresa_id ?? null, b.cnpj ?? '', b.status ?? 'OPEN', b.total_amount_cents ?? 0, b.due_date ?? null, b.paid_at ?? null, b.competencia_mes ?? null, b.competencia_ano ?? null, b.synced_at ?? null);
      }
      counts.boletos = boletos.length;

      database.prepare('DELETE FROM cora_message_templates').run();
      const insTpl = database.prepare(`
        INSERT INTO cora_message_templates (id, template_key, message_body, is_active) VALUES (?, ?, ?, ?)
      `);
      for (const t of templates) {
        insTpl.run(t.id, t.template_key, t.message_body ?? '', t.is_active ? 1 : 0);
      }
      counts.templates = templates.length;

      database.prepare('DELETE FROM cora_config').run();
      const insCfg = database.prepare(`
        INSERT INTO cora_config (chave, valor, updated_at) VALUES (?, ?, ?)
      `);
      for (const c of configs) {
        insCfg.run(c.chave, typeof c.valor === 'string' ? c.valor : JSON.stringify(c.valor || {}), c.updated_at ?? null);
      }
      counts.config = configs.length;

      database.prepare('DELETE FROM cora_envios').run();
      const insEnv = database.prepare(`
        INSERT INTO cora_envios (id, empresa_id, boleto_id, competencia_mes, competencia_ano, canal, sucesso, detalhe, tipo_envio, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const e of envios) {
        insEnv.run(e.id, e.empresa_id ?? null, e.boleto_id ?? null, e.competencia_mes ?? null, e.competencia_ano ?? null, e.canal ?? null, e.sucesso ? 1 : 0, e.detalhe ?? null, e.tipo_envio ?? null, e.created_at ?? null);
      }
      counts.envios = envios.length;

      if (r6.error) throw r6.error;
      database.prepare('DELETE FROM gclick_clients').run();
      const insGCli = database.prepare(`
        INSERT INTO gclick_clients (id, name, document, phone, envia_via_gclick)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const c of gClients) {
        insGCli.run(
          c.id,
          c.name ?? null,
          c.document ?? null,
          c.phone ?? null,
          c.envia_via_gclick ? 1 : 0,
        );
      }
      counts.gclick_clients = gClients.length;

      if (r7.error) throw r7.error;
      if (gCfg) {
        database.prepare('DELETE FROM gclick_sync_config').run();
        const mp = typeof gCfg.match_patterns === 'string'
          ? gCfg.match_patterns
          : JSON.stringify(gCfg.match_patterns || DEFAULT_GCLICK_MATCH_PATTERNS);
        database.prepare(`
          INSERT INTO gclick_sync_config (
            id, is_enabled, ask_send_confirmation_on_sync, run_mode, interval_minutes,
            competencia_mes, competencia_ano, match_patterns, last_run_at, last_run_error, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(gCfg.id || 'default'),
          gCfg.is_enabled ? 1 : 0,
          gCfg.ask_send_confirmation_on_sync ? 1 : 0,
          gCfg.run_mode || 'sync_only',
          Math.max(5, Number(gCfg.interval_minutes || 5)),
          gCfg.competencia_mes ?? null,
          gCfg.competencia_ano ?? null,
          mp,
          gCfg.last_run_at ?? null,
          gCfg.last_run_error ?? null,
          gCfg.updated_at ?? new Date().toISOString(),
        );
        counts.gclick_sync_config = 1;
      }

      if (!r8.error && gCred?.value && typeof gCred.value === 'object') {
        database.prepare(`
          INSERT INTO gclick_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run('gclick_credentials', JSON.stringify(gCred.value));
        counts.gclick_settings = 1;
      }

      database.exec('COMMIT');
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    }
    return counts;
  });
}

export { CLONE_DB_PATH };
