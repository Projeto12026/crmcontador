# Instruções para o Lovable – Corrigir envio do PDF do boleto (mensagem vai, PDF não)

## Objetivo
Ajustar para que o PDF do boleto seja baixado corretamente da API Cora e enviado pelo WhatsApp junto com a mensagem.

---

## 1. Frontend – Sempre enviar `invoiceId` no process-boleto-complete

Ao chamar `POST /api/notifications/whatsapp-optimized/process-boleto-complete`, o body **obrigatoriamente** deve incluir o **`invoiceId`** (id do boleto na Cora), além de `empresa`, `competencia`, `mensagem`, `wascriptApiUrl` e `wascriptToken`.

- Se `invoiceId` não for enviado, o Cora Proxy **não tenta** baixar nem enviar o PDF (apenas a mensagem de texto é enviada).
- O `invoiceId` vem da lista de boletos (ex.: `inv_nbqbOq1NR4ySgE8Q90pHFNw`). Ao escolher o boleto para enviar, usar o `id` desse item no payload.

**Payload mínimo esperado:**
```json
{
  "empresa": { "nome": "...", "cnpj": "...", "telefone": "..." },
  "competencia": "02/2026",
  "mensagem": "Texto da mensagem...",
  "invoiceId": "inv_xxxxxxxxxxxxxxxxxxxxxxxx",
  "wascriptApiUrl": "https://api-whatsapp.wascript.com.br",
  "wascriptToken": "..."
}
```

---

## 2. Backend (Cora Proxy) – Corrigir a forma de obter o PDF da API Cora

**Arquivo:** `backend/cora-proxy/index.js`

A API Cora **não** expõe o PDF em `/v2/invoices/{id}/document`. O fluxo correto é:

1. Obter o token (mTLS) e chamar **GET** `https://matls-clients.api.cora.com.br/v2/invoices/{invoiceId}` para obter os **detalhes do boleto**.
2. Na resposta JSON, ler a URL do PDF em **`payment_options.bank_slip.url`**.
3. Fazer **GET** nessa URL para baixar o PDF (binário).
4. Enviar o buffer do PDF para a Wascript com `sendWhatsappPdf`.

**Substituir** o bloco que hoje faz:
- `const pdfUrl = \`https://matls-clients.api.cora.com.br/v2/invoices/${invoiceId}/document\`;`
- e em seguida um único GET nessa URL para obter o PDF,

**por** o fluxo abaixo:

1. Chamar **GET** `https://matls-clients.api.cora.com.br/v2/invoices/${invoiceId}` (com certificados mTLS e header `Authorization: Bearer {access_token}`), e fazer parse da resposta JSON.
2. Verificar se existe `payment_options.bank_slip.url` na resposta.
3. Se existir, fazer **GET** nessa URL (pode ser com `fetch` ou `https.request`; a URL pode ser pública) e acumular o corpo da resposta em um buffer.
4. Se o buffer tiver conteúdo (e for um PDF válido), chamar `sendWhatsappPdf(phone, pdfBuffer, filename, '', wascriptConfig)` como já está hoje.

Resumo: **não usar** `/v2/invoices/{id}/document`. Usar **GET /v2/invoices/{id}** → ler **`payment_options.bank_slip.url`** → **GET** nessa URL → usar o buffer retornado como PDF.

---

## 3. Checklist para o Lovable

- [ ] **Frontend:** Garantir que toda chamada a `process-boleto-complete` inclui `invoiceId` no body (id do boleto selecionado).
- [ ] **Backend (cora-proxy):** Trocar o download do PDF de `GET .../v2/invoices/{id}/document` para: (1) GET detalhes do boleto em `/v2/invoices/{id}`, (2) ler `payment_options.bank_slip.url`, (3) GET nessa URL para obter o PDF, (4) passar o buffer para `sendWhatsappPdf`.
- [ ] **Backend:** Manter envio do PDF para Wascript em `/api/enviar-documento/{token}` com body `{ phone, base64, name }` (já corrigido anteriormente).
- [ ] **Ambiente:** Garantir que o Cora Proxy tem certificados mTLS (CORA_CERT_BASE64 / CORA_KEY_BASE64 ou arquivos) e CORA_CLIENT_ID para obter token e chamar a API Cora.

Após esses ajustes, a mensagem e o PDF do boleto devem ser enviados juntos pelo WhatsApp.
