/**
 * Escolha Wascript vs Lion CRM API + failover opcional (CRM Contador cora-proxy).
 *
 * Internamente o segundo provedor ainda é referenciado como "waflow" por compatibilidade
 * com chaves já salvas em `cora_config.whatsapp` (waflow_api_url, waflow_api_token).
 * O protocolo real chamado é o Lion CRM v2 (`webhook-incoming.php`).
 */

import * as cloneDb from './clone-db.js';
import {
  sanitizeWaFlowCreds,
  probeWaFlowSession,
  testWaFlowConnection,
  sendWaFlowText,
  sendWaFlowPdfFromUrl,
  sendWaFlowPdfFromBuffer,
} from './waflow.js';

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
  // 400/401/403/404 da Lion CRM são definitivos (token errado, API desabilitada, rota errada).
  if (s === 400 || s === 401 || s === 403 || s === 404) return false;
  return [500, 502, 503, 504, 429].includes(s);
}

function other(p) {
  return p === PROVIDER_WASCRIPT ? PROVIDER_WAFLOW : PROVIDER_WASCRIPT;
}

/**
 * Monta contexto a partir do body da requisição + cora_config whatsapp (clone) + env.
 */
function pickField(bodyVal, storedVal, envVal) {
  const b = String(bodyVal ?? '').trim();
  if (b) return b;
  const s = String(storedVal ?? '').trim();
  if (s) return s;
  return String(envVal ?? '').trim();
}

export function buildWhatsappContext(body = {}) {
  const row = cloneDb.getConfig('whatsapp');
  const v = row?.valor && typeof row.valor === 'object' ? row.valor : {};

  const wascript = {
    apiUrl: pickField(body.wascriptApiUrl ?? body.api_url, v.api_url, process.env.WASCRIPT_API_URL).replace(
      /\/+$/,
      '',
    ),
    token: pickField(body.wascriptToken ?? body.token, v.token, process.env.WASCRIPT_TOKEN),
  };

  const waflow = sanitizeWaFlowCreds(
    pickField(body.waflowApiUrl ?? body.waflow_api_url, v.waflow_api_url, process.env.WAFLOW_API_URL),
    pickField(body.waflowApiToken ?? body.waflow_api_token, v.waflow_api_token, process.env.WAFLOW_API_TOKEN),
  );

  const providerMode = String(
    body.whatsappProviderMode ?? body.provider_mode ?? v.provider_mode ?? process.env.WHATSAPP_PROVIDER_MODE ?? 'wascript_only',
  ).trim();

  const failoverEnabled = coerceBool(
    body.whatsappFailoverEnabled ?? body.failover_enabled ?? v.failover_enabled ?? process.env.WHATSAPP_FAILOVER_ENABLED,
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

/**
 * Validação REAL de conexão com o Wascript (sem enviar mensagem).
 * Reusa o probe (`/api/listar-etiquetas/{token}`) e formata o resultado para a UI.
 */
export async function testWascriptConnection(ws, timeoutMs = 8000) {
  const { apiUrl, token } = ws;
  if (!apiUrl) return { ok: false, error: 'URL da API Wascript não preenchida' };
  if (!token) return { ok: false, error: 'Token Wascript não preenchido' };

  const probe = await probeWascriptQuick({ apiUrl, token }, timeoutMs);
  if (probe.ok) {
    return {
      ok: true,
      httpStatus: probe.status,
      message: 'Conectado. Token e URL OK; sessão WhatsApp ativa.',
    };
  }
  if (probe.status === 401 || probe.status === 403) {
    return {
      ok: false,
      httpStatus: probe.status,
      error: probe.message || 'Token Wascript inválido.',
    };
  }
  if (probe.status === 404) {
    return {
      ok: false,
      httpStatus: 404,
      error: 'Rota não encontrada — verifique a URL base do Wascript.',
    };
  }
  if (typeof probe.status === 'number') {
    return {
      ok: false,
      httpStatus: probe.status,
      error:
        probe.message ||
        `Servidor respondeu HTTP ${probe.status}. Verifique se a sessão do WhatsApp está conectada.`,
    };
  }
  return {
    ok: false,
    error: probe.error || 'Falha de rede ao conectar ao Wascript.',
  };
}

async function chooseProvider(ctx) {
  const { providerMode, wascript: ws, waflow: wf } = ctx;
  const now = Date.now();

  if (providerMode === 'wascript_only') {
    if (!ws.apiUrl || !ws.token) throw new Error('Wascript não configurado (modo wascript_only).');
    return PROVIDER_WASCRIPT;
  }
  if (providerMode === 'waflow_only') {
    if (!wf.apiUrl || !wf.token) throw new Error('Lion CRM não configurado (modo waflow_only).');
    return PROVIDER_WAFLOW;
  }

  if (selectionCache.provider && selectionCache.until > now) {
    return selectionCache.provider;
  }

  // Em modo automático: probe só do Wascript (Lion CRM não expõe healthcheck público;
  // probe positivo geraria tráfego sem retorno útil). Se o Wascript estiver fora,
  // caímos no Lion CRM caso ele esteja preenchido.
  let picked = PROVIDER_WASCRIPT;
  const wp =
    ws.apiUrl && ws.token ? await probeWascriptQuick(ws, 5000) : { ok: false };
  const wfReady = Boolean(wf.apiUrl && wf.token);

  if (wp.ok) picked = PROVIDER_WASCRIPT;
  else if (wfReady) picked = PROVIDER_WAFLOW;
  else if (ws.apiUrl && ws.token) picked = PROVIDER_WASCRIPT;
  else throw new Error('Nenhum provedor WhatsApp configurado.');

  selectionCache = { provider: picked, until: now + CACHE_TTL_MS };
  return picked;
}

function failoverOk(err) {
  return isTransientWascriptErr(err) || isWaFlowTransientForFailover(err);
}

/**
 * Executa o envio com failover opcional. Retorna { provider, failover } onde
 * `provider` é o provedor que efetivamente entregou e `failover` indica se houve
 * salto do primário para o secundário.
 */
async function invokeWithFailover(primary, failoverEnabled, hasWsc, hasWf, runners) {
  const tryRun = async (p) => {
    if (p === PROVIDER_WASCRIPT) {
      if (!hasWsc) throw new Error('Wascript não configurado');
      await runners.wascript();
    } else {
      if (!hasWf) throw new Error('Lion CRM não configurado');
      await runners.waflow();
    }
  };

  try {
    await tryRun(primary);
    return { provider: primary, failover: false };
  } catch (e1) {
    if (!failoverEnabled || !failoverOk(e1)) throw e1;
    const sec = other(primary);
    if (sec === PROVIDER_WASCRIPT && !hasWsc) throw e1;
    if (sec === PROVIDER_WAFLOW && !hasWf) throw e1;
    console.warn('[whatsapp-router] failover para', sec, e1.message?.slice(0, 120));
    await tryRun(sec);
    return { provider: sec, failover: true };
  }
}

/**
 * @param {object} ctx - buildWhatsappContext()
 * @param {(wsConfig: object) => Promise<void>} sendWascript - recebe { apiUrl, token }
 * @returns {Promise<{ provider: 'wascript'|'waflow', failover: boolean }>}
 */
export async function sendTextRouted(phone, message, ctx, sendWascript) {
  const primary = await chooseProvider(ctx);
  const hasWsc = Boolean(ctx.wascript.apiUrl && ctx.wascript.token);
  const hasWf = Boolean(ctx.waflow.apiUrl && ctx.waflow.token);

  return invokeWithFailover(primary, ctx.failoverEnabled, hasWsc, hasWf, {
    wascript: () => sendWascript(ctx.wascript),
    waflow: () => sendWaFlowText(phone, message, ctx.waflow),
  });
}

/**
 * @param {object} opts - { pdfBuffer, pdfUrl, filename, caption }
 * @param {(wsConfig: object) => Promise<void>} sendWascriptPdf - (phone, buffer, filename, caption, wsConfig)
 * @returns {Promise<{ provider: 'wascript'|'waflow', failover: boolean }>}
 */
export async function sendPdfRouted(phone, opts, ctx, sendWascriptPdf) {
  const primary = await chooseProvider(ctx);
  const hasWsc = Boolean(ctx.wascript.apiUrl && ctx.wascript.token);
  const hasWf = Boolean(ctx.waflow.apiUrl && ctx.waflow.token);
  const { pdfBuffer, pdfUrl, filename, caption } = opts;

  return invokeWithFailover(primary, ctx.failoverEnabled, hasWsc, hasWf, {
    wascript: () => sendWascriptPdf(phone, pdfBuffer, filename, caption, ctx.wascript),
    waflow: () => {
      // Preferir URL pública (send_document) — economiza banda.
      // Fallback para buffer base64 (send_file_base64) quando não há URL.
      if (pdfUrl) {
        return sendWaFlowPdfFromUrl(phone, pdfUrl, filename, caption || '', ctx.waflow);
      }
      if (Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
        return sendWaFlowPdfFromBuffer(phone, pdfBuffer, filename, caption || '', ctx.waflow);
      }
      throw new Error('Lion CRM: nem pdfUrl nem pdfBuffer disponíveis para envio.');
    },
  });
}

/**
 * Normaliza nomes de provedor para uso no banco de dados / UI.
 * 'waflow' (id interno) -> 'lion_crm' (rótulo no DB).
 */
export function providerLabel(p) {
  if (p === PROVIDER_WASCRIPT) return 'wascript';
  if (p === PROVIDER_WAFLOW) return 'lion_crm';
  return null;
}

export { PROVIDER_WASCRIPT, PROVIDER_WAFLOW, probeWaFlowSession, testWaFlowConnection };
