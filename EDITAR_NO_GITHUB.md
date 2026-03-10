# Editar direto no GitHub – backend/cora-proxy/index.js

1. Abra: https://github.com/Projeto12026/crmcontador/blob/main/backend/cora-proxy/index.js  
2. Clique no ícone **lápis (Edit this file)** no canto superior direito.  
3. Faça as **duas** alterações abaixo (busque o texto e substitua).

---

## Alteração 1 – Envio de texto (~linha 260)

**Localize este trecho:**
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

**Substitua por:**
```javascript
  // Wascript API: token na URL. Endpoint: /api/enviar-texto/{token}
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

---

## Alteração 2 – Envio de PDF (~linha 294)

**Localize este trecho:**
```javascript
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
```

**Substitua por:**
```javascript
  // Wascript API: token na URL. Endpoint: /api/enviar-documento/{token}. Body: "name", não "filename".
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

4. Role até o final da página, preencha **Commit message** (ex.: `fix: usar endpoints Wascript enviar-texto e enviar-documento`) e clique em **Commit changes**.

Pronto. O repositório no GitHub fica corrigido; o Lovable pode puxar as mudanças ou você faz o deploy de novo.
