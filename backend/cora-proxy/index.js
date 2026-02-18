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

      request.on('error', reject);
      request.write(body.toString());
      request.end();
    });

    const parsed = JSON.parse(response.body);

    if (response.status !== 200) {
      return res.status(response.status).json({
        error: 'Erro ao obter token da Cora',
        detail: parsed,
      });
    }

    res.json(parsed);
  } catch (error) {
    console.error('Erro get-token:', error);
    res.status(500).json({ error: 'Erro interno ao obter token', detail: error.message });
  }
});

// ── Search Invoices ──────────────────────────────────
app.post('/api/cora/search-invoices', async (req, res) => {
  try {
    const { token, start, end } = req.body;

    if (!token) return res.status(400).json({ error: 'Token obrigatório' });

    const url = `https://api.cora.com.br/v2/invoices/?start=${start}&end=${end}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Erro ao buscar invoices', detail: data });
    }

    res.json(data);
  } catch (error) {
    console.error('Erro search-invoices:', error);
    res.status(500).json({ error: 'Erro interno', detail: error.message });
  }
});

// ── Download PDF ─────────────────────────────────────
app.post('/api/cora/download-pdf', async (req, res) => {
  try {
    const { token, invoiceId } = req.body;

    if (!token || !invoiceId) {
      return res.status(400).json({ error: 'Token e invoiceId obrigatórios' });
    }

    const url = `https://api.cora.com.br/v2/invoices/${invoiceId}/document`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json();
      return res.status(response.status).json({ error: 'Erro ao baixar PDF', detail: data });
    }

    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Erro download-pdf:', error);
    res.status(500).json({ error: 'Erro interno', detail: error.message });
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

  const response = await fetch(`${apiUrl}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone: cleanPhone,
      message,
    }),
  });

  const data = await response.json().catch(() => ({ error: 'Resposta inválida' }));
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

  const response = await fetch(`${apiUrl}/api/sendFile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone: cleanPhone,
      base64: `data:application/pdf;base64,${base64}`,
      filename: filename || 'boleto.pdf',
      caption: caption || '',
    }),
  });

  const data = await response.json().catch(() => ({ error: 'Resposta inválida' }));
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

    // Try to download and send PDF if we have invoiceId and token
    if (invoiceId) {
      try {
        // Get a fresh token for PDF download
        const clientId = process.env.CORA_CLIENT_ID;
        const certs = loadCertificates();
        if (clientId && certs) {
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
            const pdfUrl = `https://api.cora.com.br/v2/invoices/${invoiceId}/document`;
            const pdfResponse = await fetch(pdfUrl, {
              headers: { Authorization: `Bearer ${tokenParsed.access_token}` },
            });
            if (pdfResponse.ok) {
              const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
              const cnpjClean = (empresa.cnpj || '').replace(/\D/g, '');
              const filename = `boleto_${cnpjClean}_${competencia?.replace('/', '-') || 'ref'}.pdf`;
              await sendWhatsappPdf(phone, pdfBuffer, filename, '', wascriptConfig);
              pdfSent = true;
              // Small delay between PDF and message
              await new Promise(r => setTimeout(r, 1500));
            }
          }
        }
      } catch (pdfErr) {
        console.error('Erro ao enviar PDF:', pdfErr.message);
        // Continue to send text message even if PDF fails
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
