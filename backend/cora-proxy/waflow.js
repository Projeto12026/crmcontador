/**
 * Lion CRM WhatsApp API v2.0 (Bearer + endpoint único `webhook-incoming.php`).
 *
 * Mantemos o nome "WaFlow" externamente apenas como rótulo do "provedor alternativo"
 * dentro do roteador (`whatsapp-send-router.js`). O protocolo real é o documentado em
 * https://documenter.getpostman.com/view/43709792/2sB3dTuoJe.
 */

const MAX_RETRY = 4;
const RETRY_MS = 4000;

export function sanitizeWaFlowCreds(apiUrl, token) {
  const base = String(apiUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  return {
    apiUrl: base,
    token: String(token ?? '').trim(),
  };
}

function phoneDigitsBrazil(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length <= 11 && !d.startsWith('55')) d = '55' + d;
  return d;
}

function isTransientWaFlowErr(err) {
  const s = err?.status;
  // 400 (campo inválido), 401 (token), 403 (API desabilitada), 404 (rota errada)
  // são definitivos. 429/5xx são transitórios.
  if (s === 400 || s === 401 || s === 403 || s === 404) return false;
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
        console.warn(`[LionCRM ${label}] retry ${a}/${MAX_RETRY}:`, e.message?.slice(0, 100));
        await new Promise((r) => setTimeout(r, RETRY_MS));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

async function webhookSend(creds, payload) {
  const { apiUrl, token } = creds;
  if (!apiUrl) throw new Error('Lion CRM: URL da API não configurada');
  if (!token) throw new Error('Lion CRM: token não configurado');

  const response = await fetch(`${apiUrl}/webhook-incoming.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const err = new Error(
      `Lion CRM resposta não-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
    err.status = response.status;
    throw err;
  }
  if (!response.ok || data?.success === false) {
    const err = new Error(data.error || data.message || `Lion CRM HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

/**
 * Healthcheck "leve": apenas confirma que credenciais foram preenchidas. A API do Lion CRM
 * não expõe endpoint público de status; selecionar o provedor por probe positivo geraria
 * tráfego sem retorno útil. O failover real é feito reagindo a erros do Wascript.
 */
export function probeWaFlowSession(creds) {
  const { apiUrl, token } = creds;
  if (!apiUrl || !token) {
    return Promise.resolve({ ok: false, error: 'Credenciais incompletas' });
  }
  return Promise.resolve({ ok: true });
}

export async function sendWaFlowText(phone, message, creds) {
  const to = phoneDigitsBrazil(phone);
  return withRetry(
    () =>
      webhookSend(creds, {
        action: 'send_message',
        to,
        message: String(message ?? ''),
      }),
    'sendText',
  );
}

/** PDF por URL pública (`send_document` com campo `url`). */
export async function sendWaFlowPdfFromUrl(phone, mediaUrl, filename, caption, creds) {
  const to = phoneDigitsBrazil(phone);
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new Error('Lion CRM: URL pública do PDF obrigatória para send_document');
  }
  return withRetry(
    () =>
      webhookSend(creds, {
        action: 'send_document',
        to,
        url: mediaUrl.trim(),
        filename: filename || 'documento.pdf',
        caption: caption || '',
      }),
    'sendPdfUrl',
  );
}

/**
 * PDF por buffer (`send_file_base64`). Útil quando não há URL pública do boleto e
 * já temos o conteúdo em memória — é o caminho do failover real.
 */
export async function sendWaFlowPdfFromBuffer(phone, buffer, filename, caption, creds) {
  const to = phoneDigitsBrazil(phone);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Lion CRM: buffer do PDF vazio');
  }
  const base64 = `data:application/pdf;base64,${buffer.toString('base64')}`;
  return withRetry(
    () =>
      webhookSend(creds, {
        action: 'send_file_base64',
        to,
        base64,
        filename: filename || 'documento.pdf',
        caption: caption || '',
      }),
    'sendPdfBase64',
  );
}
