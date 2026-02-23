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
  `);
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

// ── Sync from Supabase: replace tables with data from Supabase ──
export function syncFromSupabase(supabase) {
  const database = getDb();
  const counts = { empresas: 0, boletos: 0, templates: 0, config: 0, envios: 0 };

  return Promise.all([
    supabase.from('cora_empresas').select('id, client_name, cnpj, telefone, dia_vencimento, valor_mensal, is_active, updated_at'),
    supabase.from('cora_boletos').select('id, cora_invoice_id, empresa_id, cnpj, status, total_amount_cents, due_date, paid_at, competencia_mes, competencia_ano, synced_at'),
    supabase.from('cora_message_templates').select('id, template_key, message_body, is_active'),
    supabase.from('cora_config').select('chave, valor, updated_at'),
    supabase.from('cora_envios').select('id, empresa_id, boleto_id, competencia_mes, competencia_ano, canal, sucesso, detalhe, tipo_envio, created_at'),
  ]).then(async ([r1, r2, r3, r4, r5]) => {
    const empresas = r1.data || [];
    const boletos = r2.data || [];
    const templates = r3.data || [];
    const configs = r4.data || [];
    const envios = r5.data || [];

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

      database.exec('COMMIT');
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    }
    return counts;
  });
}

export { CLONE_DB_PATH };
