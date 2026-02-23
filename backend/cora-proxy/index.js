import express from 'express';
import cors from 'cors';
import https from 'node:https';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import * as cloneDb from './clone-db.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── Helper: carrega certificados (base64 env OU arquivo) ──
function loadCertificates() {
  const certBase64 = process.env.CORA_CERT_BASE64;
  const keyBase64  = process.env.CORA_KEY_BASE64;

  // Prioridade 1: variáveis de ambiente em base64
  if (certBase64 && keyBase64) {
    return {
      cert: Buffer.from(certBase64, 'base64'),
      key:  Buffer.from(keyBase64, 'base64'),
    };
  }

  // Prioridade 2: arquivos no filesystem
  const certPath = process.env.CORA_CERT_PATH || '/certs/certificate.pem';
  const keyPath  = process.env.CORA_KEY_PATH  || '/certs/private-key.pem';

  try {
    return {
      cert: fs.readFileSync(certPath),
      key:  fs.readFileSync(keyPath),
    };
  } catch {
    return null;
  }
}

// ── Health check ──────────────────────────────────────
app.get('/api/cora/health', (_req, res) => {
  const certs = loadCertificates();
  res.json({
    status: 'ok',
    service: 'cora-proxy',
    client_id_configured: !!process.env.CORA_CLIENT_ID,
    certificates_loaded: !!certs,
    method: process.env.CORA_CERT_BASE64 ? 'base64_env' : 'file',
  });
});

// ── Get Token (mTLS) ─────────────────────────────────
app.post('/api/cora/get-token', async (req, res) => {
  try {
    const clientId = process.env.CORA_CLIENT_ID;

    if (!clientId) {
      return res.status(500).json({ error: 'CORA_CLIENT_ID não configurado' });
    }

    const certs = loadCertificates();
    if (!certs) {
      return res.status(500).json({
        error: 'Certificados mTLS não encontrados',
        detail: 'Configure CORA_CERT_BASE64 + CORA_KEY_BASE64 ou monte arquivos em /certs/',
      });
    }

    const { cert, key } = certs;

    // Monta a requisição mTLS para a API Cora
    const tokenUrl = 'https://matls-clients.api.cora.com.br/token';
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
    });

    const response = await new Promise((resolve, reject) => {
      const urlObj = new URL(tokenUrl);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        cert,
        key,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body.toString()),
        },
      };

      const request = https.request(options, (resp) => {
        let data = '';
        resp.on('data', (chunk) => (data += chunk));
        resp.on('end', () => {
          resolve({ status: resp.statusCode, body: data });
        });
      });

    request.on('error', (err) => {
        console.error('mTLS request error details:', err.code, err.message);
        reject(err);
      });
      request.write(body.toString());
      request.end();
    });

    console.log('Token response status:', response.status);
    console.log('Token response body:', response.body.substring(0, 500));

    const parsed = JSON.parse(response.body);

    if (response.status !== 200) {
      return res.status(response.status).json({
        error: 'Erro ao obter token da Cora',
        detail: parsed,
      });
    }

    res.json(parsed);
  } catch (error) {
    console.error('Erro get-token:', error.code, error.message, error.stack);
    res.status(500).json({ error: 'Erro interno ao obter token', detail: error.message, code: error.code });
  }
});

// ── Helper: mTLS GET request ─────────────────────────
function mtlsGet(url, token, certs) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      cert: certs.cert,
      key: certs.key,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    };

    const request = https.request(options, (resp) => {
      let data = '';
      resp.on('data', (chunk) => (data += chunk));
      resp.on('end', () => {
        resolve({ status: resp.statusCode, body: data });
      });
    });

    request.on('error', (err) => reject(err));
    request.end();
  });
}

// Obter token Cora (para uso interno no cron)
async function getCoraAccessToken() {
  const clientId = process.env.CORA_CLIENT_ID;
  if (!clientId) throw new Error('CORA_CLIENT_ID não configurado');
  const certs = loadCertificates();
  if (!certs) throw new Error('Certificados mTLS não encontrados');
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId });
  const tokenUrl = 'https://matls-clients.api.cora.com.br/token';
  const response = await new Promise((resolve, reject) => {
    const urlObj = new URL(tokenUrl);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      cert: certs.cert,
      key: certs.key,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body.toString()) },
    }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => (data += chunk));
      resp.on('end', () => resolve({ status: resp.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body.toString());
    req.end();
  });
  const parsed = JSON.parse(response.body);
  if (response.status !== 200 || !parsed.access_token) throw new Error(parsed.error_description || 'Falha ao obter token Cora');
  return parsed.access_token;
}

// ── Search Invoices ──────────────────────────────────
app.post('/api/cora/search-invoices', async (req, res) => {
  try {
    const { token, start, end, page = 1, perPage = 200 } = req.body;

    if (!token) return res.status(400).json({ error: 'Token obrigatório' });

    const certs = loadCertificates();
    if (!certs) {
      return res.status(500).json({ error: 'Certificados mTLS não encontrados' });
    }

    // Cora API uses page (1-based) and perPage params
    const url = `https://matls-clients.api.cora.com.br/v2/invoices/?start=${start}&end=${end}&page=${page}&perPage=${perPage}`;
    console.log('Fetching invoices URL:', url);

    const response = await mtlsGet(url, token, certs);
    console.log('Invoices response status:', response.status);
    console.log('Invoices response body:', response.body.substring(0, 1000));

    if (response.status !== 200) {
      let detail;
      try { detail = JSON.parse(response.body); } catch { detail = response.body; }
      return res.status(response.status).json({ error: 'Erro ao buscar invoices', detail });
    }

    const data = JSON.parse(response.body);
    res.json(data);
  } catch (error) {
    console.error('Erro search-invoices:', error);
    res.status(500).json({ error: 'Erro interno', detail: error.message });
  }
});

// ── Download PDF ─────────────────────────────────────
// Alinha com a lógica do api_cora:
// 1) GET /v2/invoices/{invoiceId} via mTLS para obter detalhes
// 2) Ler payment_options.bank_slip.url
// 3) Fazer GET direto nessa URL (sem mTLS) para baixar o PDF
app.post('/api/cora/download-pdf', async (req, res) => {
  try {
    const { token, invoiceId } = req.body;

    if (!token || !invoiceId) {
      return res.status(400).json({ error: 'Token e invoiceId obrigatórios' });
    }

    const certs = loadCertificates();
    if (!certs) {
      return res.status(500).json({ error: 'Certificados mTLS não encontrados' });
    }

    // 1) Buscar detalhes do boleto na API Cora
    const invoiceUrl = `https://matls-clients.api.cora.com.br/v2/invoices/${invoiceId}`;
    const invoiceResp = await mtlsGet(invoiceUrl, token, certs);

    if (invoiceResp.status !== 200) {
      let detail;
      try { detail = JSON.parse(invoiceResp.body); } catch { detail = invoiceResp.body; }
      console.error('Erro ao buscar detalhes do boleto para PDF:', invoiceResp.status, detail);
      return res.status(502).json({
        error: 'Erro ao buscar informações do boleto para PDF',
        detail,
      });
    }

    let invoiceData;
    try {
      invoiceData = JSON.parse(invoiceResp.body);
    } catch (e) {
      console.error('Erro ao parsear JSON do boleto para PDF:', e);
      return res.status(500).json({
        error: 'Resposta inválida da API Cora ao obter detalhes do boleto',
        detail: e.message,
      });
    }

    const pdfUrl = invoiceData?.payment_options?.bank_slip?.url;
    if (!pdfUrl) {
      console.error('URL do PDF não encontrada em payment_options.bank_slip.url');
      return res.status(404).json({
        error: 'PDF não disponível para este boleto',
        message: 'Este boleto não possui PDF disponível na API Cora',
      });
    }

    // 2) Baixar o PDF diretamente da URL retornada pela Cora
    const pdfResponse = await fetch(pdfUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    });

    if (!pdfResponse.ok) {
      const text = await pdfResponse.text().catch(() => '');
      console.error('Erro ao baixar PDF da URL da Cora:', pdfResponse.status, text.substring(0, 500));
      return res.status(502).json({
        error: 'Erro ao baixar PDF da URL fornecida pela Cora',
        status: pdfResponse.status,
        detail: text.substring(0, 500),
      });
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set('Content-Type', 'application/pdf');
    res.send(buffer);
  } catch (error) {
    console.error('Erro download-pdf:', error);
    res.status(500).json({ error: 'Erro ao baixar PDF', detail: error.message });
  }
});

// ── WhatsApp via Wascript ────────────────────────────

// Helper: get Wascript config from env or request body
function getWascriptConfig(body = {}) {
  return {
    apiUrl: body.wascriptApiUrl || process.env.WASCRIPT_API_URL || '',
    token: body.wascriptToken || process.env.WASCRIPT_TOKEN || '',
  };
}

// Erros que indicam falha temporária (sessão/conexão) e vale tentar de novo
function isTransientWascriptError(err) {
  const msg = (err && err.message) ? String(err.message) : '';
  return /reconecte|token|sessão whatsapp|desconectad|desconhecido/i.test(msg);
}

// Executa uma chamada Wascript com até 3 tentativas quando o erro for de sessão/token
async function withWascriptRetry(fn, context = '') {
  const maxAttempts = 3;
  const delayMs = 4000;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (isTransientWascriptError(e) && attempt < maxAttempts) {
        console.warn(`[Wascript${context}] Falha temporária (${attempt}/${maxAttempts}):`, e.message?.slice(0, 120), '- nova tentativa em', delayMs, 'ms');
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function sendWhatsappMessage(phone, message, wascriptConfig) {
  const { apiUrl, token } = wascriptConfig;
  if (!apiUrl || !token) throw new Error('Wascript API URL ou token não configurado');

  // Normalize phone: remove non-digits, add 55 prefix if needed
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }

  return withWascriptRetry(async () => {
    const response = await fetch(`${apiUrl}/api/enviar-texto/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message,
      }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      console.error(`[Wascript sendText] Resposta não-JSON (status ${response.status}):`, responseText.slice(0, 500));
      throw new Error(`Wascript retornou status ${response.status} com resposta não-JSON: ${responseText.slice(0, 200)}`);
    }
    if (!response.ok) throw new Error(data.error || data.message || `Wascript HTTP ${response.status}`);
    return data;
  }, ' sendText');
}

async function sendWhatsappPdf(phone, pdfBuffer, filename, caption, wascriptConfig) {
  const { apiUrl, token } = wascriptConfig;
  if (!apiUrl || !token) throw new Error('Wascript API URL ou token não configurado');

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }

  const base64 = pdfBuffer.toString('base64');

  return withWascriptRetry(async () => {
    const response = await fetch(`${apiUrl}/api/enviar-documento/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        base64: `data:application/pdf;base64,${base64}`,
        name: filename || 'boleto.pdf',
      }),
    });

    const responseText2 = await response.text();
    let data;
    try {
      data = responseText2 ? JSON.parse(responseText2) : {};
    } catch {
      console.error(`[Wascript sendFile] Resposta não-JSON (status ${response.status}):`, responseText2.slice(0, 500));
      throw new Error(`Wascript retornou status ${response.status} com resposta não-JSON: ${responseText2.slice(0, 200)}`);
    }
    if (!response.ok) throw new Error(data.error || data.message || `Wascript HTTP ${response.status}`);
    return data;
  }, ' sendFile');
}

// ── Send reminder (text only) ──────────────────────
app.post('/api/notifications/whatsapp-optimized/send-reminder', async (req, res) => {
  try {
    const { empresa, mensagem, wascriptApiUrl, wascriptToken } = req.body;
    const wascriptConfig = getWascriptConfig({ wascriptApiUrl, wascriptToken });
    const phone = empresa?.telefone;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'Telefone inválido' });
    }
    if (!mensagem) return res.status(400).json({ success: false, error: 'Mensagem vazia' });

    await sendWhatsappMessage(phone, mensagem, wascriptConfig);
    res.json({ success: true, message: 'Lembrete enviado' });
  } catch (error) {
    console.error('Erro send-reminder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Process boleto complete (PDF + message) ─────────
app.post('/api/notifications/whatsapp-optimized/process-boleto-complete', async (req, res) => {
  try {
    const { empresa, competencia, invoiceId, mensagem, wascriptApiUrl, wascriptToken } = req.body;
    const wascriptConfig = getWascriptConfig({ wascriptApiUrl, wascriptToken });
    const phone = empresa?.telefone;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'Telefone inválido' });
    }

    let pdfSent = false;

    // Tentar baixar e enviar o PDF se tivermos invoiceId
    if (invoiceId) {
      try {
        const clientId = process.env.CORA_CLIENT_ID;
        const certs = loadCertificates();
        if (clientId && certs) {
          // 1) Obter token de acesso direto na Cora (mTLS)
          const tokenUrl = 'https://matls-clients.api.cora.com.br/token';
          const tokenBody = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
          });

          const tokenResponse = await new Promise((resolve, reject) => {
            const urlObj = new URL(tokenUrl);
            const options = {
              hostname: urlObj.hostname,
              path: urlObj.pathname,
              method: 'POST',
              cert: certs.cert,
              key: certs.key,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(tokenBody.toString()),
              },
            };
            const request = https.request(options, (resp) => {
              let data = '';
              resp.on('data', (chunk) => (data += chunk));
              resp.on('end', () => resolve({ status: resp.statusCode, body: data }));
            });
            request.on('error', reject);
            request.write(tokenBody.toString());
            request.end();
          });

          const tokenParsed = JSON.parse(tokenResponse.body);
          if (tokenResponse.status === 200 && tokenParsed.access_token) {
            const accessToken = tokenParsed.access_token;

            // 2) Buscar detalhes do boleto para obter payment_options.bank_slip.url
            const invoiceUrl = `https://matls-clients.api.cora.com.br/v2/invoices/${invoiceId}`;
            const invoiceResp = await mtlsGet(invoiceUrl, accessToken, certs);

            if (invoiceResp.status === 200) {
              let invoiceData;
              try {
                invoiceData = JSON.parse(invoiceResp.body);
              } catch (e) {
                console.error('Erro ao parsear JSON do boleto (process-boleto-complete):', e);
                invoiceData = null;
              }

              const pdfUrl = invoiceData?.payment_options?.bank_slip?.url;
              if (pdfUrl) {
                // 3) Baixar o PDF diretamente da URL retornada pela Cora
                const pdfResponse = await fetch(pdfUrl, {
                  method: 'GET',
                  headers: { 'Accept': 'application/pdf' },
                });

                if (pdfResponse.ok) {
                  const arrayBuffer = await pdfResponse.arrayBuffer();
                  const pdfBuffer = Buffer.from(arrayBuffer);

                  const cnpjClean = (empresa.cnpj || '').replace(/\D/g, '');
                  const filename = `boleto_${cnpjClean}_${competencia?.replace('/', '-') || 'ref'}.pdf`;
                  await sendWhatsappPdf(phone, pdfBuffer, filename, '', wascriptConfig);
                  pdfSent = true;
                  await new Promise(r => setTimeout(r, 1500));
                } else {
                  const text = await pdfResponse.text().catch(() => '');
                  console.error('Erro ao baixar PDF na process-boleto-complete:', pdfResponse.status, text.substring(0, 500));
                }
              } else {
                console.warn('payment_options.bank_slip.url não encontrada para o boleto', invoiceId);
              }
            } else {
              console.error('Erro ao buscar detalhes do boleto na process-boleto-complete:', invoiceResp.status, invoiceResp.body.substring(0, 500));
            }
          }
        }
      } catch (pdfErr) {
        console.error('Erro ao enviar PDF:', pdfErr.message);
        // Continua para envio da mensagem de texto mesmo se PDF falhar
      }
    }

    // Send text message
    if (mensagem) {
      await sendWhatsappMessage(phone, mensagem, wascriptConfig);
    }

    res.json({ success: true, pdfSent, messageSent: !!mensagem });
  } catch (error) {
    console.error('Erro process-boleto-complete:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: validar CRON_SECRET
function checkCronSecret(req) {
  const secret = req.query.secret || req.get('X-Cron-Secret') || '';
  const cronSecret = process.env.CRON_SECRET || '';
  return !cronSecret || secret === cronSecret;
}

// ── Sync clone (Supabase → SQLite) ───────────────────
// POST /api/notifications/whatsapp-optimized/sync-clone
app.post('/api/notifications/whatsapp-optimized/sync-clone', async (req, res) => {
  try {
    if (!checkCronSecret(req)) return res.status(401).json({ error: 'Não autorizado' });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios' });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const counts = await cloneDb.syncFromSupabase(supabase);
    res.json({ success: true, ...counts });
  } catch (error) {
    console.error('Erro sync-clone:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Run scheduled sends (cron) ───────────────────────
// POST /api/notifications/whatsapp-optimized/run-scheduled-sends
// Lê/escreve no clone SQLite; grava novos envios também no Supabase para o front.
function parseLocalDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

app.post('/api/notifications/whatsapp-optimized/run-scheduled-sends', async (req, res) => {
  try {
    if (!checkCronSecret(req)) return res.status(401).json({ error: 'Não autorizado' });
    const certs = loadCertificates();
    if (!certs) return res.status(500).json({ error: 'Certificados mTLS não encontrados' });

    let supabase = null;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) supabase = createClient(supabaseUrl, supabaseKey);

    const today = startOfDay(new Date());
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    // 1) Token Cora
    const token = await getCoraAccessToken();

    // 2) Empresas do clone (mapear CNPJ -> empresa_id)
    const empresasList = cloneDb.getEmpresas();
    const cnpjToEmpresaId = new Map();
    const empresaById = new Map();
    empresasList.forEach((e) => {
      const cnpj = (e.cnpj || '').replace(/\D/g, '');
      cnpjToEmpresaId.set(cnpj, e.id);
      empresaById.set(e.id, e);
    });

    // 3) Sincronizar boletos da API Cora para o clone (mês atual e próximo)
    for (const { mes, ano } of [{ mes: currentMonth, ano: currentYear }, { mes: nextMonth, ano: nextYear }]) {
      const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const lastDay = new Date(ano, mes, 0).getDate();
      const end = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`;
      let page = 1;
      const perPage = 200;
      let totalItems = Infinity;
      let fetched = 0;
      const batch = [];
      while (fetched < totalItems) {
        const url = `https://matls-clients.api.cora.com.br/v2/invoices/?start=${start}&end=${end}&page=${page}&perPage=${perPage}`;
        const resp = await mtlsGet(url, token, certs);
        if (resp.status !== 200) break;
        let data;
        try { data = JSON.parse(resp.body); } catch { break; }
        const items = data.items || data.invoices || [];
        if (data.totalItems != null) totalItems = data.totalItems;
        fetched += items.length;
        for (const inv of items) {
          const rawCnpj = String(inv.customer_document || inv.customer?.document || '').replace(/\D/g, '');
          const status = (inv.status || 'OPEN').toUpperCase();
          const dueDate = inv.due_date || inv.dueDate || null;
          const totalCents = Number(inv.total_amount) || Number(inv.amount?.value) || 0;
          const invoiceId = String(inv.id || inv.invoice_id || '');
          if (!invoiceId) continue;
          batch.push({
            cora_invoice_id: invoiceId,
            empresa_id: cnpjToEmpresaId.get(rawCnpj) || null,
            cnpj: rawCnpj,
            status,
            total_amount_cents: totalCents,
            due_date: dueDate,
            paid_at: inv.paid_at || inv.paidAt || null,
            competencia_mes: mes,
            competencia_ano: ano,
            synced_at: new Date().toISOString(),
          });
        }
        if (items.length === 0) break;
        page++;
      }
      if (batch.length) cloneDb.upsertBoletos(batch);
    }

    // 4) Carregar dados do clone
    const boletosList = cloneDb.getBoletos(['OPEN', 'LATE']);
    const templatesList = cloneDb.getTemplates();
    const enviosList = cloneDb.getEnvios();
    const sentSet = new Set();
    enviosList.forEach((e) => {
      if (e.sucesso && e.tipo_envio) sentSet.add(`${e.empresa_id}|${e.competencia_mes}|${e.competencia_ano}|${e.tipo_envio}`);
    });

    const whatsappCfg = cloneDb.getConfig('whatsapp');
    const whatsappVal = whatsappCfg?.valor || {};
    const wascriptApiUrl = whatsappVal.api_url || process.env.WASCRIPT_API_URL || '';
    const wascriptToken = whatsappVal.token || process.env.WASCRIPT_TOKEN || '';

    const backendBase = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const processBoletoUrl = `${backendBase}/api/notifications/whatsapp-optimized/process-boleto-complete`;
    const sendReminderUrl = `${backendBase}/api/notifications/whatsapp-optimized/send-reminder`;

    function resolveTemplate(templateKey, empresa, boleto, competencia) {
      const t = templatesList.find((x) => x.template_key === templateKey);
      if (!t) return '';
      const nome = empresa.client_name || 'Cliente';
      const amount = (boleto && boleto.total_amount_cents) ? boleto.total_amount_cents / 100 : (empresa.valor_mensal || 0);
      const valor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(amount));
      const dueDate = boleto?.due_date ? parseLocalDate(boleto.due_date) : null;
      const vencimento = dueDate ? dueDate.toLocaleDateString('pt-BR') : competencia;
      let diasAtraso = 0;
      if (boleto?.status === 'LATE' && boleto?.due_date) {
        const due = parseLocalDate(boleto.due_date);
        if (due) diasAtraso = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / 86400000));
      }
      return t.message_body
        .replace(/\{\{nome\}\}/g, nome)
        .replace(/\{\{competencia\}\}/g, competencia)
        .replace(/\{\{vencimento\}\}/g, vencimento)
        .replace(/\{\{valor\}\}/g, valor)
        .replace(/\{\{dias_atraso\}\}/g, String(diasAtraso));
    }

    const TIPOS = { AVISO_5_ANTES: { templateKey: 'before_due', pdf: true }, LEMBRETE_DIA: { templateKey: 'reminder_today', pdf: false }, AVISO_2_ATRASO: { templateKey: 'after_due', pdf: true }, AVISO_5_ATRASO: { templateKey: 'after_due', pdf: true } };
    const results = { sent: 0, skipped: 0, errors: [] };

    for (const boleto of boletosList) {
      const empresaId = boleto.empresa_id;
      if (!empresaId) continue;
      const empresa = empresaById.get(empresaId);
      if (!empresa || !empresa.telefone || String(empresa.telefone).replace(/\D/g, '').length < 10) continue;

      const due = parseLocalDate(boleto.due_date);
      if (!due) continue;
      const dueStart = startOfDay(due);
      const diasAte = Math.ceil((dueStart.getTime() - today.getTime()) / 86400000);
      const diasApos = today.getTime() >= dueStart.getTime() ? Math.ceil((today.getTime() - dueStart.getTime()) / 86400000) : -1;
      const competencia = `${String(boleto.competencia_mes).padStart(2, '0')}/${boleto.competencia_ano}`;
      const key = (tipo) => `${empresaId}|${boleto.competencia_mes}|${boleto.competencia_ano}|${tipo}`;

      let action = null;
      if (diasAte === 5 && !sentSet.has(key('AVISO_5_ANTES'))) action = { tipo: 'AVISO_5_ANTES', ...TIPOS.AVISO_5_ANTES };
      else if (diasAte === 0 && !sentSet.has(key('LEMBRETE_DIA'))) action = { tipo: 'LEMBRETE_DIA', ...TIPOS.LEMBRETE_DIA };
      else if (diasApos === 2 && boleto.status === 'LATE' && !sentSet.has(key('AVISO_2_ATRASO'))) action = { tipo: 'AVISO_2_ATRASO', ...TIPOS.AVISO_2_ATRASO };
      else if (diasApos === 5 && boleto.status === 'LATE' && !sentSet.has(key('AVISO_5_ATRASO'))) action = { tipo: 'AVISO_5_ATRASO', ...TIPOS.AVISO_5_ATRASO };

      if (!action) { results.skipped++; continue; }

      const mensagem = resolveTemplate(action.templateKey, empresa, boleto, competencia);
      const body = {
        empresa: { telefone: empresa.telefone, cnpj: empresa.cnpj, client_name: empresa.client_name },
        wascriptApiUrl,
        wascriptToken,
      };

      try {
        if (action.pdf) {
          body.competencia = competencia;
          body.invoiceId = boleto.cora_invoice_id;
          body.mensagem = mensagem || undefined;
          const r = await fetch(processBoletoUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const json = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        } else {
          body.mensagem = mensagem;
          if (!body.mensagem) { results.skipped++; continue; }
          const r = await fetch(sendReminderUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const json = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        }
        const envioRow = {
          empresa_id: empresaId,
          boleto_id: boleto.id,
          competencia_mes: boleto.competencia_mes,
          competencia_ano: boleto.competencia_ano,
          canal: 'WHATSAPP',
          sucesso: true,
          tipo_envio: action.tipo,
          detalhe: action.tipo,
        };
        cloneDb.insertEnvio(envioRow);
        if (supabase) {
          const { id: _id, ...rest } = envioRow;
          await supabase.from('cora_envios').insert(rest);
        }
        sentSet.add(key(action.tipo));
        results.sent++;
      } catch (err) {
        results.errors.push({ empresa: empresa.client_name || empresa.cnpj, tipo: action.tipo, error: err.message });
        const envioRow = {
          empresa_id: empresaId,
          boleto_id: boleto.id,
          competencia_mes: boleto.competencia_mes,
          competencia_ano: boleto.competencia_ano,
          canal: 'WHATSAPP',
          sucesso: false,
          tipo_envio: action.tipo,
          detalhe: err.message || 'Erro',
        };
        cloneDb.insertEnvio(envioRow);
        if (supabase) {
          const { id: _id, ...rest } = envioRow;
          await supabase.from('cora_envios').insert(rest);
        }
      }
      await new Promise((r) => setTimeout(r, 2500));
    }

    res.json({ success: true, sent: results.sent, skipped: results.skipped, errors: results.errors });
  } catch (error) {
    console.error('Erro run-scheduled-sends:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Run daily (10h): sync-clone + run-scheduled-sends em sequência ──
// POST /api/notifications/whatsapp-optimized/run-daily
app.post('/api/notifications/whatsapp-optimized/run-daily', async (req, res) => {
  try {
    if (!checkCronSecret(req)) return res.status(401).json({ error: 'Não autorizado' });
    const base = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const secret = req.query.secret || req.get('X-Cron-Secret') || '';
    const q = secret ? `?secret=${encodeURIComponent(secret)}` : '';

    const syncRes = await fetch(`${base}/api/notifications/whatsapp-optimized/sync-clone${q}`, { method: 'POST' });
    const syncJson = await syncRes.json().catch(() => ({}));
    if (!syncRes.ok) {
      return res.status(syncRes.status).json({ success: false, step: 'sync-clone', error: syncJson.error || syncRes.statusText });
    }

    const runRes = await fetch(`${base}/api/notifications/whatsapp-optimized/run-scheduled-sends${q}`, { method: 'POST' });
    const runJson = await runRes.json().catch(() => ({}));
    if (!runRes.ok) {
      return res.status(runRes.status).json({ success: false, step: 'run-scheduled-sends', error: runJson.error || runRes.statusText });
    }

    res.json({ success: true, sync: syncJson, run: runJson });
  } catch (error) {
    console.error('Erro run-daily:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Cora Proxy rodando na porta ${PORT}`);
});
