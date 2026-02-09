# Cora Proxy — Backend mTLS

Serviço de proxy para a API Cora com autenticação mTLS (certificado cliente).

## Endpoints

| Método | Rota                        | Descrição                    |
|--------|-----------------------------|------------------------------|
| GET    | `/api/cora/health`          | Health check                 |
| POST   | `/api/cora/get-token`       | Obtém token via mTLS         |
| POST   | `/api/cora/search-invoices` | Busca invoices por período   |
| POST   | `/api/cora/download-pdf`    | Baixa PDF de um invoice      |

## Variáveis de Ambiente

| Variável          | Obrigatória | Descrição                          |
|-------------------|-------------|------------------------------------|
| `CORA_CLIENT_ID`  | ✅          | Client ID da aplicação Cora        |
| `CORA_CERT_PATH`  | ❌          | Caminho do certificado (padrão: `/certs/certificate.pem`) |
| `CORA_KEY_PATH`   | ❌          | Caminho da chave privada (padrão: `/certs/private-key.pem`) |
| `PORT`            | ❌          | Porta do servidor (padrão: `3001`) |

## Deploy no EasyPanel

### 1. Criar o serviço
- No EasyPanel, no mesmo projeto do frontend, clique em **+ New Service → App**
- Nome: `cora-proxy`
- Source: apontar para o repositório Git, subpath `backend/cora-proxy`
- Ou faça build local e push para um registry

### 2. Configurar variáveis de ambiente
No serviço `cora-proxy`, vá em **Environment** e adicione:
```
CORA_CLIENT_ID=seu_client_id_aqui
PORT=3001
```

### 3. Montar os certificados
Vá em **Volumes/Mounts** e monte os arquivos `.pem`:
- Tipo: **File** ou **Volume**
- Source: cole o conteúdo do `certificate.pem`
- Mount path: `/certs/certificate.pem`
- Repita para `/certs/private-key.pem`

### 4. Configurar o domínio/proxy
No serviço do **frontend**, adicione uma regra de proxy:
- Vá em **Domains** do frontend
- Adicione: Path `/api/cora` → proxy para `cora-proxy:3001`

Ou configure um domínio separado para o backend e aponte o frontend para ele.

### 5. Testar
```bash
curl -X POST https://crm.controledinheiro.com/api/cora/get-token
```
