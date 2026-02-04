import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CORA_API_BASE = 'https://matls-clients.api.cora.com.br';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Assinatura padrão
const SIGNATURE = `\n\n— *Financeiro Nescon*\nMensagem automática: se já pagou, desconsidere :)`;

interface Empresa {
  nome: string;
  cnpj: string;
  telefone: string;
  apelido?: string;
}

interface ProcessRequest {
  empresa: Empresa;
  competencia: string; // MM/AAAA
  invoiceId?: string;
}

interface StepResult {
  step: string;
  success: boolean;
  error?: string;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

function createMTLSClient() {
  const certificate = Deno.env.get('CORA_CERTIFICATE');
  const privateKey = Deno.env.get('CORA_PRIVATE_KEY');

  if (!certificate || !privateKey) {
    throw new Error('Cora certificates not configured');
  }

  return Deno.createHttpClient({
    caCerts: [],
    cert: certificate,
    key: privateKey,
  });
}

async function getCoraToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const clientId = Deno.env.get('CORA_CLIENT_ID');
  if (!clientId) {
    throw new Error('CORA_CLIENT_ID not configured');
  }

  const httpClient = createMTLSClient();

  const response = await fetch(`${CORA_API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
    }),
    client: httpClient,
  });

  if (!response.ok) {
    throw new Error(`Failed to get Cora token: ${response.status}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

async function searchInvoices(cnpj: string, competencia: string) {
  const token = await getCoraToken();
  const httpClient = createMTLSClient();

  const [month, year] = competencia.split('/');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const cleanCnpj = cnpj.replace(/\D/g, '');
  const url = `${CORA_API_BASE}/v2/invoices?search=${cleanCnpj}&start=${startDate}&end=${endDate}&page=1&perPage=100`;

  console.log('Searching invoices for competencia:', competencia);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    client: httpClient,
  });

  if (!response.ok) {
    throw new Error(`Failed to search invoices: ${response.status}`);
  }

  return response.json();
}

async function getInvoiceDetails(invoiceId: string) {
  const token = await getCoraToken();
  const httpClient = createMTLSClient();

  const response = await fetch(`${CORA_API_BASE}/v2/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    client: httpClient,
  });

  if (!response.ok) {
    throw new Error(`Failed to get invoice details: ${response.status}`);
  }

  return response.json();
}

async function downloadPdf(pdfUrl: string): Promise<string> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWhatsAppConfig(supabase: any) {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('ativo', true)
    .single();

  if (error || !data) {
    throw new Error('WhatsApp config not found or not active');
  }

  return data as { token: string; api_url: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMessageTemplate(supabase: any) {
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('ativo', true)
    .limit(1)
    .single();

  if (error || !data) {
    return {
      template_antes_vencimento: `Olá! Segue o boleto da empresa {nome_empresa}.\n\nVencimento: {data_vencimento}\nValor: R$ {valor_boleto}`,
      template_pos_vencimento: `Olá! O boleto da empresa {nome_empresa} está vencido há {dias_vencimento} dias.\n\nValor: R$ {valor_boleto}\n\nPor favor, regularize o pagamento.`,
    };
  }

  return data as { template_antes_vencimento: string; template_pos_vencimento: string };
}

function formatMessage(template: string, data: {
  apelido?: string;
  nome_empresa: string;
  data_vencimento: string;
  dias_vencimento: number;
  valor_boleto: string;
}): string {
  let message = template
    .replace(/{apelido}/g, data.apelido || data.nome_empresa)
    .replace(/{nome_empresa}/g, data.nome_empresa)
    .replace(/{data_vencimento}/g, data.data_vencimento)
    .replace(/{dias_vencimento}/g, data.dias_vencimento.toString())
    .replace(/{valor_boleto}/g, data.valor_boleto);
  
  // Add signature
  message += SIGNATURE;
  
  return message;
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    cleaned = '55' + cleaned;
  } else if (cleaned.length === 10) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 502 && retries > 0) {
      console.log(`502 error, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    
    return response;
  } catch (err) {
    if (retries > 0) {
      console.log(`Request failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

async function sendWhatsAppText(config: { token: string; api_url: string }, phone: string, message: string) {
  const formattedPhone = formatPhone(phone);
  const url = `${config.api_url}/api/enviar-texto/${config.token}`;

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: formattedPhone, message }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send WhatsApp text: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function sendWhatsAppDocument(config: { token: string; api_url: string }, phone: string, base64: string, name: string) {
  const formattedPhone = formatPhone(phone);
  const url = `${config.api_url}/api/enviar-documento/${config.token}`;

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: formattedPhone,
      base64: `data:application/pdf;base64,${base64}`,
      name,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send WhatsApp document: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function generatePdfName(empresa: Empresa, competencia: string, valor: string): string {
  const nome = (empresa.apelido || empresa.nome)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 30);
  const comp = competencia.replace('/', '_');
  const valorFormatado = valor.replace(',', '-');
  return `Boleto_${nome}_${comp}_R$${valorFormatado}.pdf`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const steps: StepResult[] = [];
  let currentStep = 'init';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { empresa, competencia, invoiceId: providedInvoiceId }: ProcessRequest = await req.json();

    console.log('Processing boleto for:', empresa.nome, 'competencia:', competencia);

    // Validate input
    currentStep = 'validation';
    if (!empresa || !empresa.cnpj || !empresa.telefone) {
      throw new Error('Empresa com CNPJ e telefone é obrigatório');
    }

    const phoneDigits = empresa.telefone.replace(/\D/g, '').length;
    if (phoneDigits < 10) {
      throw new Error(`Telefone inválido: mínimo 10 dígitos (encontrado: ${phoneDigits})`);
    }

    if (!competencia || !/^\d{2}\/\d{4}$/.test(competencia)) {
      throw new Error('Competência deve estar no formato MM/AAAA');
    }

    steps.push({ step: 'validation', success: true });

    // Step 1: Search for invoice
    currentStep = 'search_invoice';
    let invoiceId = providedInvoiceId;

    if (!invoiceId) {
      const searchResult = await searchInvoices(empresa.cnpj, competencia);
      
      if (!searchResult.items || searchResult.items.length === 0) {
        throw new Error('Nenhum boleto encontrado para o período informado');
      }

      invoiceId = searchResult.items[0].id;
    }

    steps.push({ step: 'search_invoice', success: true });

    // Step 2: Get invoice details
    currentStep = 'get_details';
    const invoiceDetails = await getInvoiceDetails(invoiceId!);
    console.log('Invoice details obtained:', invoiceId);
    steps.push({ step: 'get_details', success: true });

    // Step 3: Download PDF
    currentStep = 'download_pdf';
    const pdfUrl = invoiceDetails.payment_options?.bank_slip?.url;
    if (!pdfUrl) {
      throw new Error('URL do PDF não encontrada no boleto');
    }

    const pdfBase64 = await downloadPdf(pdfUrl);
    console.log('PDF downloaded successfully');
    steps.push({ step: 'download_pdf', success: true });

    // Step 4: Get WhatsApp config and templates
    currentStep = 'get_config';
    const whatsappConfig = await getWhatsAppConfig(supabase);
    const templates = await getMessageTemplate(supabase);
    steps.push({ step: 'get_config', success: true });

    // Step 5: Prepare message
    currentStep = 'prepare_message';
    const dueDate = invoiceDetails.due_date || invoiceDetails.payment_options?.bank_slip?.due_date;
    const isLate = invoiceDetails.status === 'LATE' || calculateDaysOverdue(dueDate) > 0;
    const daysOverdue = calculateDaysOverdue(dueDate);
    
    const amount = (invoiceDetails.total_amount / 100).toFixed(2).replace('.', ',');
    const formattedDueDate = new Date(dueDate).toLocaleDateString('pt-BR');

    const template = isLate ? templates.template_pos_vencimento : templates.template_antes_vencimento;
    const message = formatMessage(template, {
      apelido: empresa.apelido,
      nome_empresa: empresa.nome,
      data_vencimento: formattedDueDate,
      dias_vencimento: daysOverdue,
      valor_boleto: amount,
    });

    console.log('Message prepared, isLate:', isLate);
    steps.push({ step: 'prepare_message', success: true });

    // Step 6: Send text message
    currentStep = 'send_text';
    await sendWhatsAppText(whatsappConfig, empresa.telefone, message);
    console.log('Text message sent');
    steps.push({ step: 'send_text', success: true });

    // Step 7: Wait 5 seconds
    currentStep = 'wait';
    await new Promise(resolve => setTimeout(resolve, 5000));
    steps.push({ step: 'wait', success: true });

    // Step 8: Send PDF
    currentStep = 'send_pdf';
    const pdfName = generatePdfName(empresa, competencia, amount);
    await sendWhatsAppDocument(whatsappConfig, empresa.telefone, pdfBase64, pdfName);
    console.log('PDF sent');
    steps.push({ step: 'send_pdf', success: true });

    return new Response(JSON.stringify({
      success: true,
      invoiceId,
      message: 'Boleto enviado com sucesso',
      steps,
      details: {
        empresa: empresa.nome,
        competencia,
        valor: amount,
        vencimento: formattedDueDate,
        isLate,
        daysOverdue,
        telefone: formatPhone(empresa.telefone),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Process boleto error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    steps.push({ step: currentStep, success: false, error: errorMessage });

    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        step: currentStep,
        steps,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
