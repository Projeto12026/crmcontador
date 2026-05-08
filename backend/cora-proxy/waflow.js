/**
 * WaFlow / MoltFlow API v2 (Bearer + session_id).
 */

const DEFAULT_BASE = 'https://apiv2.waiflow.app';
const MAX_RETRY = 4;
const RETRY_MS = 4000;

export function sanitizeWaFlowCreds(apiUrl, token, sessionId) {
  const base = String(apiUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  return {
    apiUrl: base || DEFAULT_BASE,
    token: String(token ?? '').trim(),
    sessionId: String(sessionId ?? '').trim(),
  };
}

function phoneDigitsBrazil(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length <= 11 && !d.startsWith('55')) d = '55' + d;
  return d;
}

function isTransientWaFlowErr(err) {
  const s = err?.status;
  if (s === 401 || s === 403 || s === 404 || s === 400) return false;
  if ([500, 502, 503, 504, 429].includes(s)) return true;
  const msg = String(err?.message || '').toLowerCase();
  return /timeout|econnreset|fetch failed|socket|temporar/i.test(msg);
}

async function withRetry(fn, label) {
  let last;
  for (let a = 1; a <= MAX_RETRY; a++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (isTransientWaFlowErr(e) && a < MAX_RETRY) {
        console.warn(`[WaFlow ${label}] retry ${a}/${MAX_RETRY}:`, e.message?.slice(0, 100));
        await new Promise((r) => setTimeout(r, RETRY_MS));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

async function messagesSend(creds, payload) {
  const { apiUrl, token, sessionId } = creds;
  if (!token || !sessionId) throw new Error('WaFlow: token ou session_id ausente');

  const response = await fetch(`${apiUrl}/api/v2/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ session_id: sessionId, ...payload }),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`WaFlow resposta não-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    const err = new Error(data.message || data.error || `WaFlow HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function probeWaFlowSession(creds, timeoutMs = 5000) {
  try {
    const { apiUrl, token, sessionId } = creds;
    if (!token || !sessionId) return { ok: false, error: 'Credenciais incompletas' };

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const resp = await fetch(`${apiUrl}/api/v2/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: ac.signal,
    });
    clearTimeout(t);

    const body = await resp.json().catch(() => ({}));
    const okHttp = resp.ok && resp.status === 200;
    const st =
      body?.status || body?.data?.status || body?.session?.status || body?.state || '';
    let working = okHttp;
    if (typeof st === 'string') {
      working = okHttp && ['WORKING', 'working', 'CONNECTED', 'connected'].includes(st);
      if (/scan|stopped|fail|disconnect/i.test(st)) working = false;
    }
    return { ok: working, httpStatus: resp.status, rawStatus: typeof st === 'string' ? st : '' };
  } catch (e) {
    return {
      ok: false,
      error: e.name === 'AbortError' ? `timeout ${timeoutMs}ms` : e.message,
    };
  }
}

export async function sendWaFlowText(phone, message, creds) {
  const phoneDigits = phoneDigitsBrazil(phone);
  return withRetry(async () => {
    await messagesSend(creds, { phone: phoneDigits, message });
  }, 'sendText');
}

/** PDF por URL pública (media_url). */
export async function sendWaFlowPdfFromUrl(phone, mediaUrl, filename, caption, creds) {
  const phoneDigits = phoneDigitsBrazil(phone);
  const msg = caption || filename || 'Documento';
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new Error('WaFlow: media_url do PDF obrigatória');
  }

  return withRetry(async () => {
    await messagesSend(creds, {
      phone: phoneDigits,
      message: msg,
      media_url: mediaUrl.trim(),
    });
  }, 'sendPdf');
}
