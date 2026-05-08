/**
 * Escolha Wascript vs WaFlow + failover opcional (CRM Contador cora-proxy).
 */

import * as cloneDb from './clone-db.js';
import { sanitizeWaFlowCreds, probeWaFlowSession, sendWaFlowText, sendWaFlowPdfFromUrl } from './waflow.js';

const PROVIDER_WASCRIPT = 'wascript';
const PROVIDER_WAFLOW = 'waflow';
const CACHE_TTL_MS = 45_000;

let selectionCache = { provider: null, until: 0 };

function coerceBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export function clearWhatsappProviderCache() {
  selectionCache = { provider: null, until: 0 };
}

function isTransientWascriptErr(err) {
  const s = err?.status;
  if ([500, 501, 502, 503, 504, 429].includes(s)) return true;
  const msg = String(err?.message || '').toLowerCase();
  return /reconecte|token|sess[ãa]o\s*whatsapp|desconectad|desconhecido|whatsapp\s*n[ãa]o\s*aberta|api\s*desconectada/i.test(
    msg
  );
}

function isWaFlowTransientForFailover(err) {
  const s = err?.status;
  if (s === 401 || s === 403 || s === 404 || s === 400) return false;
  return [500, 502, 503, 504, 429].includes(s);
}

function other(p) {
  return p === PROVIDER_WASCRIPT ? PROVIDER_WAFLOW : PROVIDER_WASCRIPT;
}

/**
 * Monta contexto a partir do body da requisição + cora_config whatsapp (clone) + env.
 */
export function buildWhatsappContext(body = {}) {
  const row = cloneDb.getConfig('whatsapp');
  const v = row?.valor && typeof row.valor === 'object' ? row.valor : {};

  const wascript = {
    apiUrl: String(body.wascriptApiUrl || v.api_url || process.env.WASCRIPT_API_URL || '')
      .trim()
      .replace(/\/+$/, ''),
    token: String(body.wascriptToken || v.token || process.env.WASCRIPT_TOKEN || '').trim(),
  };

  const waflow = sanitizeWaFlowCreds(
    body.waflowApiUrl || v.waflow_api_url || process.env.WAFLOW_API_URL,
    body.waflowApiToken || v.waflow_api_token || process.env.WAFLOW_API_TOKEN,
    body.waflowSessionId || v.waflow_session_id || process.env.WAFLOW_SESSION_ID
  );

  const providerMode = String(
    body.whatsappProviderMode || v.provider_mode || process.env.WHATSAPP_PROVIDER_MODE || 'wascript_only'
  ).trim();

  const failoverEnabled = coerceBool(
    body.whatsappFailoverEnabled ?? v.failover_enabled ?? process.env.WHATSAPP_FAILOVER_ENABLED
  );

  return { wascript, waflow, providerMode, failoverEnabled };
}

export async function probeWascriptQuick(ws, timeoutMs = 5000) {
  const { apiUrl, token } = ws;
  if (!apiUrl || !token) return { ok: false, error: 'Wascript não configurado' };
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const resp = await fetch(`${apiUrl}/api/listar-etiquetas/${token}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: ac.signal,
    });
    clearTimeout(t);
    const data = await resp.json().catch(() => ({}));
    return {
      ok: resp.ok && resp.status === 200 && data.success !== false,
      status: resp.status,
      message: data?.message || '',
    };
  } catch (e) {
    return {
      ok: false,
      error: e.name === 'AbortError' ? `timeout ${timeoutMs}ms` : e.message,
    };
  }
}

async function chooseProvider(ctx) {
  const { providerMode, wascript: ws, waflow: wf } = ctx;
  const now = Date.now();

  if (providerMode === 'wascript_only') {
    if (!ws.apiUrl || !ws.token) throw new Error('Wascript não configurado (modo wascript_only).');
    return PROVIDER_WASCRIPT;
  }
  if (providerMode === 'waflow_only') {
    if (!wf.token || !wf.sessionId) throw new Error('WaFlow não configurado (modo waflow_only).');
    return PROVIDER_WAFLOW;
  }

  if (selectionCache.provider && selectionCache.until > now) {
    return selectionCache.provider;
  }

  let picked = PROVIDER_WASCRIPT;
  const [wp, fp] = await Promise.all([
    ws.apiUrl && ws.token ? probeWascriptQuick(ws, 5000) : { ok: false },
    wf.token && wf.sessionId ? probeWaFlowSession(wf, 5000) : { ok: false },
  ]);

  if (wp.ok) picked = PROVIDER_WASCRIPT;
  else if (fp.ok) picked = PROVIDER_WAFLOW;
  else if (ws.apiUrl && ws.token) picked = PROVIDER_WASCRIPT;
  else if (wf.token && wf.sessionId) picked = PROVIDER_WAFLOW;
  else throw new Error('Nenhum provedor WhatsApp configurado.');

  selectionCache = { provider: picked, until: now + CACHE_TTL_MS };
  return picked;
}

function failoverOk(err) {
  return isTransientWascriptErr(err) || isWaFlowTransientForFailover(err);
}

async function invokeWithFailover(primary, failoverEnabled, hasWsc, hasWf, runners) {
  const tryRun = async (p) => {
    if (p === PROVIDER_WASCRIPT) {
      if (!hasWsc) throw new Error('Wascript não configurado');
      await runners.wascript();
    } else {
      if (!hasWf) throw new Error('WaFlow não configurado');
      await runners.waflow();
    }
  };

  try {
    await tryRun(primary);
  } catch (e1) {
    if (!failoverEnabled || !failoverOk(e1)) throw e1;
    const sec = other(primary);
    if (sec === PROVIDER_WASCRIPT && !hasWsc) throw e1;
    if (sec === PROVIDER_WAFLOW && !hasWf) throw e1;
    console.warn('[whatsapp-router] failover para', sec, e1.message?.slice(0, 120));
    await tryRun(sec);
  }
}

/**
 * @param {object} ctx - buildWhatsappContext()
 * @param {(wsConfig: object) => Promise<void>} sendWascript - recebe { apiUrl, token }
 */
export async function sendTextRouted(phone, message, ctx, sendWascript) {
  const primary = await chooseProvider(ctx);
  const hasWsc = Boolean(ctx.wascript.apiUrl && ctx.wascript.token);
  const hasWf = Boolean(ctx.waflow.token && ctx.waflow.sessionId);

  await invokeWithFailover(primary, ctx.failoverEnabled, hasWsc, hasWf, {
    wascript: () => sendWascript(ctx.wascript),
    waflow: () => sendWaFlowText(phone, message, ctx.waflow),
  });
}

/**
 * @param {object} opts - { pdfBuffer, pdfUrl, filename, caption }
 * @param {(wsConfig: object) => Promise<void>} sendWascriptPdf - (phone, buffer, filename, caption, wsConfig)
 */
export async function sendPdfRouted(phone, opts, ctx, sendWascriptPdf) {
  const primary = await chooseProvider(ctx);
  const hasWsc = Boolean(ctx.wascript.apiUrl && ctx.wascript.token);
  const hasWf = Boolean(ctx.waflow.token && ctx.waflow.sessionId);
  const { pdfBuffer, pdfUrl, filename, caption } = opts;

  await invokeWithFailover(primary, ctx.failoverEnabled, hasWsc, hasWf, {
    wascript: () => sendWascriptPdf(phone, pdfBuffer, filename, caption, ctx.wascript),
    waflow: () => {
      if (!pdfUrl) {
        throw new Error(
          'WaFlow exige URL pública do PDF (media_url). Obtenha payment_options.bank_slip.url na Cora.'
        );
      }
      return sendWaFlowPdfFromUrl(phone, pdfUrl, filename, caption || '', ctx.waflow);
    },
  });
}

export { PROVIDER_WASCRIPT, PROVIDER_WAFLOW };
