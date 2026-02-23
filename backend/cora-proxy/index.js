import express from 'express';
import cors from 'cors';
import https from 'node:https';
import fs from 'node:fs';

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

async function sendWhatsappMessage(phone, message, wascriptConfig) {
  const { apiUrl, token } = wascriptConfig;
  if (!apiUrl || !token) throw new Error('Wascript API URL ou token não configurado');

  // Normalize phone: remove non-digits, add 55 prefix if needed
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }

  // Wascript API: token vai na URL, não em Authorization. Endpoint correto: /api/enviar-texto/{token}
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
}

async function sendWhatsappPdf(phone, pdfBuffer, filename, caption, wascriptConfig) {
  const { apiUrl, token } = wascriptConfig;
  if (!apiUrl || !token) throw new Error('Wascript API URL ou token não configurado');

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }

  const base64 = pdfBuffer.toString('base64');

  // Wascript API: token na URL. Endpoint correto: /api/enviar-documento/{token}. Body usa "name", não "filename".
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Cora Proxy rodando na porta ${PORT}`);
});
