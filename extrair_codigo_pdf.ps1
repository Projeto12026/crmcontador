# Extrai todo o código relacionado ao envio de PDF para WhatsApp
# Execute no PowerShell: .\extrair_codigo_pdf.ps1
# Ou: powershell -ExecutionPolicy Bypass -File extrair_codigo_pdf.ps1

$arquivo = "backend\cora-proxy\index.js"
$saida   = "CODIGO_ENVIO_PDF.txt"

$conteudo = Get-Content $arquivo -Raw

# Cabecalho
@"
================================================================================
CÓDIGO ENVOLVIDO NO ENVIO DE PDF - backend/cora-proxy/index.js
Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
================================================================================

"@ | Out-File $saida -Encoding utf8

# 1. Função sendWhatsappPdf (linhas ~285-319)
@"

--- 1. FUNÇÃO sendWhatsappPdf (envio do PDF para Wascript) ---

"@ | Out-File $saida -Append -Encoding utf8
Get-Content $arquivo | Select-Object -Skip 283 -First 40 | Out-File $saida -Append -Encoding utf8

# 2. Bloco process-boleto-complete (download + envio PDF)
@"

--- 2. FLUXO process-boleto-complete (download PDF Cora + envio) ---

"@ | Out-File $saida -Append -Encoding utf8
Get-Content $arquivo | Select-Object -Skip 339 -First 95 | Out-File $saida -Append -Encoding utf8

Write-Host "Arquivo gerado: $saida"
Write-Host "Abra e envie o conteudo para validacao."
