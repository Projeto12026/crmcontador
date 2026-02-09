import express from 'express';
import cors from 'cors';
import https from 'node:https';
import fs from 'node:fs';

const app = express();
app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────
app.get('/api/cora/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cora-proxy' });
});

// ── Get Token (mTLS) ─────────────────────────────────
app.post('/api/cora/get-token', async (req, res) => {
  try {
    const clientId = process.env.CORA_CLIENT_ID;
    const certPath = process.env.CORA_CERT_PATH || '/certs/certificate.pem';
    const keyPath  = process.env.CORA_KEY_PATH  || '/certs/private-key.pem';

    if (!clientId) {
      return res.status(500).json({ error: 'CORA_CLIENT_ID não configurado' });
    }

    // Lê os certificados do filesystem
    let cert, key;
    try {
      cert = fs.readFileSync(certPath);
      key  = fs.readFileSync(keyPath);
    } catch (e) {
      return res.status(500).json({
        error: 'Certificados mTLS não encontrados',
        detail: `Verifique os arquivos em ${certPath} e ${keyPath}`,
      });
    }

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Cora Proxy rodando na porta ${PORT}`);
});
