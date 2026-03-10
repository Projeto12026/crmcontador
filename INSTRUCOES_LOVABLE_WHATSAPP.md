# Correção: Erro "Resposta inválida" / "Cannot POST /api/sendText" no envio WhatsApp

## Causa do erro

O **Cora Proxy** (`backend/cora-proxy/index.js`) estava chamando endpoints **incorretos** da API Wascript (https://api-whatsapp.wascript.com.br). A Wascript retornava **404** porque as rotas não existem:

- Usado (errado): `POST {apiUrl}/api/sendText`  → **404 Cannot POST /api/sendText**
- Usado (errado): `POST {apiUrl}/api/sendFile` → não existe

A API Wascript usa **token na URL** e nomes de endpoint diferentes.

---

## O que o Lovable deve ajustar

**Arquivo:** `backend/cora-proxy/index.js`

### 1. Envio de texto (função `sendWhatsappMessage`, ~linha 260)

**Antes (errado):**
```javascript
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
```

**Depois (correto):**
- **URL:** `POST ${apiUrl}/api/enviar-texto/${token}` (token na URL, não em header).
- **Headers:** apenas `Content-Type: application/json` e `Accept: application/json` (sem `Authorization: Bearer`).
- **Body:** continua `{ phone: cleanPhone, message }`.

Exemplo:
```javascript
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
```

### 2. Envio de documento/PDF (função `sendWhatsappPdf`, ~linha 294)

**Antes (errado):**
```javascript
const response = await fetch(`${apiUrl}/api/sendFile`, {
  ...
  headers: { 'Authorization': `Bearer ${token}`, ... },
  body: JSON.stringify({
    phone: cleanPhone,
    base64: `data:application/pdf;base64,${base64}`,
    filename: filename || 'boleto.pdf',
    caption: caption || '',
  }),
});
```

**Depois (correto):**
- **URL:** `POST ${apiUrl}/api/enviar-documento/${token}` (token na URL).
- **Headers:** apenas `Content-Type` e `Accept` (sem Bearer).
- **Body:** usar o campo **`name`** em vez de **`filename`**. A API Wascript não usa `caption` no envio de documento (conforme documentação).

Exemplo:
```javascript
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
```

---

## Resumo da API Wascript

| Ação        | URL (base: api-whatsapp.wascript.com.br)     | Token        | Body                          |
|------------|-----------------------------------------------|-------------|-------------------------------|
| Enviar texto | `POST /api/enviar-texto/{token}`             | Na URL      | `{ phone, message }`          |
| Enviar documento | `POST /api/enviar-documento/{token}`     | Na URL      | `{ phone, base64, name }`     |

- **Base64 do PDF:** deve ter o prefixo `data:application/pdf;base64,`.
- **Telefone:** com DDI 55 (ex.: 5511999998888).

---

## Variáveis de ambiente

Garantir que o Cora Proxy receba:

- `WASCRIPT_API_URL` = `https://api-whatsapp.wascript.com.br`
- `WASCRIPT_TOKEN` = token da conta Wascript

(ou que o frontend envie `wascriptApiUrl` e `wascriptToken` no body das requisições.)

---

## Alterações já aplicadas neste clone

As correções acima já foram aplicadas no arquivo  
`backend/cora-proxy/index.js` neste repositório clonado.  
Você pode comparar com o projeto no Lovable/GitHub e replicar as mesmas mudanças, ou fazer merge deste branch.
