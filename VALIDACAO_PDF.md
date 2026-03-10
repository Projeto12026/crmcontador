# Validação do envio de PDF – mensagem vai, PDF não

## Comando para extrair o código e me passar

No repositório **crmcontador** (ou na pasta do cora-proxy), rode no PowerShell:

```powershell
cd backend\cora-proxy
Get-Content index.js | Select-Object -Skip 282 -First 140 | Out-File -FilePath ..\..\CODIGO_PDF.txt -Encoding utf8
```

Depois abra `CODIGO_PDF.txt` e envie o conteúdo (ou cole aqui) para validar.

**Alternativa (uma linha):**

```powershell
Get-Content "backend\cora-proxy\index.js" -Raw | Set-Content "CODIGO_PDF_RAW.txt"
```

Envie o arquivo `CODIGO_PDF_RAW.txt` ou as linhas **285 a 430** do `backend/cora-proxy/index.js`.

---

## O que pode estar errado (e o que validar)

### 1. **Frontend não envia `invoiceId`**

No `process-boleto-complete` o PDF **só é baixado e enviado** se vier `invoiceId` no body:

```javascript
if (invoiceId) {
  // ... download PDF e sendWhatsappPdf
}
```

- **Validar:** O frontend está mandando `invoiceId` no `POST /api/notifications/whatsapp-optimized/process-boleto-complete`?  
  Payload esperado: `{ empresa, competencia, mensagem, invoiceId, wascriptApiUrl, wascriptToken }`.  
  Se `invoiceId` vier `undefined`/null, o proxy nem tenta o PDF.

### 2. **URL do PDF na Cora está incorreta no proxy**

No cora-proxy está assim:

```javascript
const pdfUrl = `https://matls-clients.api.cora.com.br/v2/invoices/${invoiceId}/document`;
```

No **api_cora** (que funciona), o PDF não vem de `/document`. O fluxo é:

1. `GET /v2/invoices/{invoiceId}` (detalhes do boleto)
2. Ler **`payment_options.bank_slip.url`** da resposta
3. Baixar o PDF fazendo **GET** nessa URL

Ou seja: a API Cora pode **não** expor `/v2/invoices/{id}/document`. O PDF costuma vir da URL que vem dentro do boleto.

**Ajuste sugerido no cora-proxy:**

- Fazer **GET** `https://matls-clients.api.cora.com.br/v2/invoices/${invoiceId}` (com token e mTLS).
- Se existir `payment_options.bank_slip.url`, usar essa URL para baixar o PDF (GET nessa URL; pode ser link público, conforme api_cora).
- Só então chamar `sendWhatsappPdf(phone, pdfBuffer, filename, '', wascriptConfig)`.

### 3. **Certificados mTLS no proxy**

O download do PDF (e do token) usa `loadCertificates()`. Se no ambiente do proxy (Docker/EasyPanel) os certificados não estiverem disponíveis ou o path estiver errado, o token ou o GET do boleto falham e o PDF não é obtido.

- **Validar:** `CORA_CERT_BASE64` e `CORA_KEY_BASE64` (ou arquivos de cert/key) configurados no ambiente do cora-proxy.
- **Validar:** logs do proxy ao tentar enviar boleto (erro de certificado, 401, 404 no GET do invoice ou do PDF).

### 4. **Resposta da Wascript no envio do documento**

A função `sendWhatsappPdf` chama `/api/enviar-documento/${token}`. Se a Wascript responder com status diferente de 2xx ou corpo não-JSON, o código lança erro e o “envio” pode estar falhando sem mensagem clara.

- **Validar:** log da resposta (status e body) da Wascript ao enviar o PDF (adicionar `console.log(response.status, responseText2)` antes do `JSON.parse`).

---

## Checklist rápido

- [ ] Frontend envia `invoiceId` no body de `process-boleto-complete`.
- [ ] No proxy: trocar download do PDF de `/v2/invoices/{id}/document` para: GET invoice → usar `payment_options.bank_slip.url` → GET nessa URL → buffer do PDF.
- [ ] Certificados Cora (mTLS) configurados no ambiente do cora-proxy.
- [ ] Log da resposta da Wascript ao enviar documento (status + body) para ver se retorna erro ou formato inesperado.

Depois de rodar o comando e enviar o trecho de código (ou o arquivo), dá para apontar exatamente onde ajustar no `index.js` (linhas e blocos).
