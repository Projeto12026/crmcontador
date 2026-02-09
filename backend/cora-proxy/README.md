# Cora Proxy — Backend mTLS para API Cora

Serviço de proxy para a API Cora com autenticação mTLS (certificado cliente).

## Endpoints

| Método | Rota                        | Descrição                    |
|--------|-----------------------------|------------------------------|
| GET    | `/api/cora/health`          | Health check + status config |
| POST   | `/api/cora/get-token`       | Obtém token via mTLS         |
| POST   | `/api/cora/search-invoices` | Busca invoices por período   |
| POST   | `/api/cora/download-pdf`    | Baixa PDF de um invoice      |

## Variáveis de Ambiente

| Variável             | Obrigatória | Descrição                                     |
|----------------------|-------------|-----------------------------------------------|
| `CORA_CLIENT_ID`     | ✅          | Client ID da aplicação Cora                   |
| `CORA_CERT_BASE64`   | ✅*         | Certificado `.pem` codificado em base64       |
| `CORA_KEY_BASE64`    | ✅*         | Chave privada `.pem` codificada em base64     |
| `CORA_CERT_PATH`     | ❌          | Alternativa: caminho do cert (padrão: `/certs/certificate.pem`) |
| `CORA_KEY_PATH`      | ❌          | Alternativa: caminho da key (padrão: `/certs/private-key.pem`)  |
| `PORT`               | ❌          | Porta do servidor (padrão: `3001`)            |

> \* Se `CORA_CERT_BASE64` e `CORA_KEY_BASE64` estiverem definidos, os arquivos são ignorados.

---

## 🚀 Deploy no EasyPanel — Passo a Passo Completo

### Pré-requisitos
- Acesso ao EasyPanel da sua VPS
- Certificados `.pem` da Cora (certificate.pem e private-key.pem)
- Client ID da aplicação Cora

---

### Passo 1: Converter certificados para base64

No terminal do seu computador, execute:

```bash
# No Linux/Mac:
base64 -w 0 certificate.pem > cert_base64.txt
base64 -w 0 private-key.pem > key_base64.txt

# No Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pem")) > cert_base64.txt
[Convert]::ToBase64String([IO.File]::ReadAllBytes("private-key.pem")) > key_base64.txt
```

Copie o conteúdo de cada arquivo `.txt` — será usado no Passo 4.

---

### Passo 2: Criar o serviço no EasyPanel

1. Acesse o painel do EasyPanel (`https://seu-easypanel.com`)
2. Abra o projeto onde o frontend está hospedado
3. Clique em **"+ Service"** → **"App"**
4. Configure:
   - **Nome do serviço**: `cora-proxy`
   - **Source**: GitHub (apontar para o repositório)
   - **Build Path**: `backend/cora-proxy` (subdiretório do Dockerfile)
   - **Port**: `3001`

> ⚠️ Se o EasyPanel não suportar subpath do Git, veja a alternativa no Passo 2B.

---

### Passo 2B: Alternativa — Build manual com Docker

Se preferir fazer build local e push para o registry:

```bash
cd backend/cora-proxy

# Build da imagem
docker build -t seu-registry.com/cora-proxy:latest .

# Push para registry
docker push seu-registry.com/cora-proxy:latest
```

No EasyPanel, selecione **"Docker Image"** como source e cole a URL da imagem.

---

### Passo 3: Configurar a porta

No serviço `cora-proxy` no EasyPanel:
1. Vá em **"Domains"** (ou "Network")
2. Verifique que a porta interna está como `3001`

---

### Passo 4: Adicionar variáveis de ambiente

No serviço `cora-proxy`, vá em **"Environment"** e adicione:

```env
CORA_CLIENT_ID=seu_client_id_aqui
CORA_CERT_BASE64=cole_aqui_o_conteudo_do_cert_base64
CORA_KEY_BASE64=cole_aqui_o_conteudo_da_key_base64
PORT=3001
```

Clique em **Save** e o serviço será reiniciado.

---

### Passo 5: Configurar o proxy no frontend

Para que o frontend acesse o backend em `https://crm.controledinheiro.com/api/cora/...`, configure o proxy no serviço do **frontend**:

**Opção A — Via EasyPanel (recomendado):**
1. No serviço do frontend, vá em **"Domains"**
2. O domínio `crm.controledinheiro.com` já deve existir
3. Adicione uma **regra de proxy**:
   - **Path**: `/api/cora`
   - **Target**: `cora-proxy` (nome do serviço)
   - **Port**: `3001`

**Opção B — Via Nginx (se o EasyPanel não tiver proxy por path):**

Edite o `nginx.conf` do frontend e adicione antes do `location /`:

```nginx
location /api/cora/ {
    proxy_pass http://cora-proxy:3001/api/cora/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> O nome `cora-proxy` funciona porque os serviços no mesmo projeto EasyPanel compartilham a mesma rede Docker.

---

### Passo 6: Testar

Após o deploy, teste:

```bash
# Health check
curl https://crm.controledinheiro.com/api/cora/health

# Deve retornar:
# {"status":"ok","service":"cora-proxy","client_id_configured":true,"certificates_loaded":true,"method":"base64_env"}

# Get token
curl -X POST https://crm.controledinheiro.com/api/cora/get-token

# Deve retornar o access_token da Cora
```

---

### Passo 7: Verificar no frontend

Na página `/cora` do sistema:
1. Vá na aba **Parâmetros**
2. Na seção "API Cora", o Client ID já deve estar configurado
3. Clique em **Sincronizar** no Dashboard para testar a busca de boletos

---

## 🔧 Troubleshooting

| Problema | Solução |
|----------|---------|
| `Certificados mTLS não encontrados` | Verifique se `CORA_CERT_BASE64` e `CORA_KEY_BASE64` foram definidos |
| `CORA_CLIENT_ID não configurado` | Adicione a variável de ambiente |
| `502 Bad Gateway` no proxy | Verifique se o serviço `cora-proxy` está rodando (porta 3001) |
| `connection refused` | Os serviços devem estar no mesmo projeto EasyPanel |
| Erro SSL/TLS | Os certificados podem estar expirados ou inválidos |
