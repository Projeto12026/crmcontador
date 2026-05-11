#!/usr/bin/env node
/**
 * Migra dados do modulo financeiro do Supabase para o Postgres local.
 *
 * Uso:
 *   SUPABASE_DB_URL='postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres' \
 *   LOCAL_DB_URL='postgresql://postgres:SENHA@host:5432/crmcontador_finance' \
 *   node scripts/migrate-from-supabase.mjs
 *
 * Tabelas migradas (na ordem para respeitar FKs):
 *   1) account_categories
 *   2) financial_accounts
 *   3) financial_categories
 *   4) credit_cards
 *   5) credit_card_invoices  (payment_transaction_id em segundo passo)
 *   6) cash_flow_transactions
 *   7) financial_transactions
 *
 * Idempotente: usa INSERT ... ON CONFLICT (id) DO NOTHING.
 * Desabilita temporariamente o trigger cft_auto_link_invoice para nao
 * recalcular invoices durante o backfill (vai vir tudo coerente do Supabase).
 */

import pg from 'pg';

const { Client } = pg;

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const LOCAL_DB_URL = process.env.LOCAL_DB_URL;

if (!SUPABASE_DB_URL || !LOCAL_DB_URL) {
  console.error('ERRO: defina SUPABASE_DB_URL e LOCAL_DB_URL nas variaveis de ambiente.');
  process.exit(1);
}

const TABLES_ORDER = [
  'account_categories',
  'financial_accounts',
  'financial_categories',
  'credit_cards',
  'credit_card_invoices',
  'cash_flow_transactions',
  'financial_transactions',
];

const COLUMNS = {
  account_categories: ['id', 'name', 'group_number', 'parent_id', 'created_at', 'updated_at'],
  financial_accounts: [
    'id', 'name', 'type', 'initial_balance', 'current_balance',
    'account_category_id', 'created_at', 'updated_at',
  ],
  financial_categories: ['id', 'name', 'type', 'color', 'is_active', 'created_at'],
  credit_cards: [
    'id', 'financial_account_id', 'brand', 'credit_limit',
    'closing_day', 'due_day', 'color', 'icon', 'created_at', 'updated_at',
  ],
  credit_card_invoices: [
    'id', 'credit_card_id', 'period_year', 'period_month',
    'closing_date', 'due_date', 'total_value', 'status', 'paid_date',
    'payment_transaction_id', 'created_at', 'updated_at',
  ],
  cash_flow_transactions: [
    'id', 'date', 'account_id', 'description',
    'future_income', 'future_expense', 'income', 'expense', 'value',
    'origin_destination', 'financial_account_id', 'type', 'paid_by_company',
    'client_id', 'contract_id', 'notes', 'source',
    'due_date', 'paid_date', 'status',
    'payment_method', 'classification', 'recurrence_type',
    'credit_card_id', 'credit_invoice_id',
    'installment_group_id', 'installment_number', 'installment_total',
    'created_at', 'updated_at',
  ],
  financial_transactions: [
    'id', 'client_id', 'contract_id', 'category_id', 'type',
    'description', 'amount', 'due_date', 'paid_date', 'status', 'notes',
    'created_at', 'updated_at',
  ],
};

async function fetchAll(client, table, columns) {
  const colsSql = columns.map((c) => `"${c}"`).join(', ');
  const res = await client.query(`SELECT ${colsSql} FROM public.${table}`);
  return res.rows;
}

async function insertBatch(client, table, columns, rows) {
  if (!rows.length) return 0;
  const colList = columns.map((c) => `"${c}"`).join(', ');

  // Builds VALUES ($1,$2,...),($n,$n+1,...) com batch para evitar parametros demais
  const BATCH = 200;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const valuesSql = slice
      .map(
        (_, rowIdx) =>
          '(' +
          columns
            .map((__, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`)
            .join(', ') +
          ')',
      )
      .join(', ');

    const params = [];
    for (const row of slice) {
      for (const col of columns) {
        params.push(row[col] ?? null);
      }
    }

    const sql = `
      INSERT INTO public.${table} (${colList})
      VALUES ${valuesSql}
      ON CONFLICT (id) DO NOTHING
    `;
    const res = await client.query(sql, params);
    inserted += res.rowCount;
  }
  return inserted;
}

async function count(client, table) {
  const res = await client.query(`SELECT COUNT(*)::INT AS n FROM public.${table}`);
  return res.rows[0].n;
}

async function main() {
  console.log('==> conectando no Supabase...');
  const src = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await src.connect();

  console.log('==> conectando no Postgres local...');
  const dst = new Client({ connectionString: LOCAL_DB_URL });
  await dst.connect();

  // Desabilitar triggers para nao recalcular invoices
  console.log('==> desabilitando triggers em cash_flow_transactions...');
  await dst.query('ALTER TABLE public.cash_flow_transactions DISABLE TRIGGER USER');

  const summary = {};

  try {
    for (const table of TABLES_ORDER) {
      const columns = COLUMNS[table];
      const before = await count(dst, table);
      console.log(`\n=== ${table} ===`);
      console.log(`  destino antes: ${before}`);

      let rows;
      if (table === 'credit_card_invoices') {
        // Carregar SEM payment_transaction_id no primeiro passo para evitar FK
        const colsSemPay = columns.filter((c) => c !== 'payment_transaction_id');
        rows = await fetchAll(src, table, colsSemPay);
        console.log(`  lidos do supabase: ${rows.length} (sem payment_transaction_id)`);
        const inserted = await insertBatch(dst, table, colsSemPay, rows);
        console.log(`  inseridos: ${inserted}`);
      } else {
        rows = await fetchAll(src, table, columns);
        console.log(`  lidos do supabase: ${rows.length}`);
        const inserted = await insertBatch(dst, table, columns, rows);
        console.log(`  inseridos: ${inserted}`);
      }

      const after = await count(dst, table);
      console.log(`  destino depois: ${after}`);
      summary[table] = { source: rows.length, destBefore: before, destAfter: after };
    }

    // Segunda passada: preencher payment_transaction_id em credit_card_invoices
    console.log('\n=== payment_transaction_id em credit_card_invoices (2a passada) ===');
    const invsRes = await src.query(
      'SELECT id, payment_transaction_id FROM public.credit_card_invoices WHERE payment_transaction_id IS NOT NULL',
    );
    let updated = 0;
    for (const inv of invsRes.rows) {
      const r = await dst.query(
        'UPDATE public.credit_card_invoices SET payment_transaction_id = $1 WHERE id = $2 AND payment_transaction_id IS DISTINCT FROM $1',
        [inv.payment_transaction_id, inv.id],
      );
      updated += r.rowCount;
    }
    console.log(`  invoices atualizadas com payment_transaction_id: ${updated}`);
  } finally {
    console.log('\n==> reabilitando triggers em cash_flow_transactions...');
    await dst.query('ALTER TABLE public.cash_flow_transactions ENABLE TRIGGER USER');
  }

  console.log('\n========================================');
  console.log('RESUMO FINAL:');
  console.log('========================================');
  for (const t of TABLES_ORDER) {
    const s = summary[t];
    const match = s.source === s.destAfter ? 'OK' : 'DIVERGENCIA';
    console.log(
      `  ${t.padEnd(25)} source=${String(s.source).padStart(6)}  dest=${String(s.destAfter).padStart(6)}  ${match}`,
    );
  }

  await src.end();
  await dst.end();
  console.log('\nFeito.');
}

main().catch((e) => {
  console.error('ERRO na migracao:', e);
  process.exit(1);
});
