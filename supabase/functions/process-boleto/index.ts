import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CORA_API_BASE = 'https://matls-clients.api.cora.com.br';

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

  // Parse competencia (MM/AAAA)
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
    // Return default templates
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
  return template
    .replace(/{apelido}/g, data.apelido || data.nome_empresa)
    .replace(/{nome_empresa}/g, data.nome_empresa)
    .replace(/{data_vencimento}/g, data.data_vencimento)
    .replace(/{dias_vencimento}/g, data.dias_vencimento.toString())
    .replace(/{valor_boleto}/g, data.valor_boleto);
}

async function sendWhatsAppText(config: { token: string; api_url: string }, phone: string, message: string) {
  const formattedPhone = phone.replace(/\D/g, '').length === 11 
    ? '55' + phone.replace(/\D/g, '') 
    : phone.replace(/\D/g, '');

  const url = `${config.api_url}/api/enviar-texto/${config.token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: formattedPhone, message }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send WhatsApp text: ${response.status}`);
  }

  return response.json();
}

async function sendWhatsAppDocument(config: { token: string; api_url: string }, phone: string, base64: string, name: string) {
  const formattedPhone = phone.replace(/\D/g, '').length === 11 
    ? '55' + phone.replace(/\D/g, '') 
    : phone.replace(/\D/g, '');

  const url = `${config.api_url}/api/enviar-documento/${config.token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: formattedPhone,
      base64: `data:application/pdf;base64,${base64}`,
      name,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send WhatsApp document: ${response.status}`);
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { empresa, competencia, invoiceId: providedInvoiceId }: ProcessRequest = await req.json();

    console.log('Processing boleto for:', empresa.nome, 'competencia:', competencia);

    // Validate input
    if (!empresa || !empresa.cnpj || !empresa.telefone) {
      throw new Error('empresa with cnpj and telefone is required');
    }

    if (!competencia || !/^\d{2}\/\d{4}$/.test(competencia)) {
      throw new Error('competencia must be in MM/AAAA format');
    }

    // Step 1: Search for invoice
    let invoiceId = providedInvoiceId;
    let invoice;

    if (!invoiceId) {
      const searchResult = await searchInvoices(empresa.cnpj, competencia);
      
      if (!searchResult.items || searchResult.items.length === 0) {
        throw new Error('No invoices found for the given period');
      }

      invoice = searchResult.items[0];
      invoiceId = invoice.id;
    }

    // Step 2: Get invoice details
    const invoiceDetails = await getInvoiceDetails(invoiceId!);
    console.log('Invoice details obtained:', invoiceId);

    // Step 3: Download PDF
    const pdfUrl = invoiceDetails.payment_options?.bank_slip?.url;
    if (!pdfUrl) {
      throw new Error('PDF URL not found in invoice');
    }

    const pdfBase64 = await downloadPdf(pdfUrl);
    console.log('PDF downloaded successfully');

    // Step 4: Get WhatsApp config and templates
    const whatsappConfig = await getWhatsAppConfig(supabase);
    const templates = await getMessageTemplate(supabase);

    // Step 5: Prepare message
    const dueDate = invoiceDetails.due_date || invoiceDetails.payment_options?.bank_slip?.due_date;
    const isLate = invoiceDetails.status === 'LATE' || calculateDaysOverdue(dueDate) > 0;
    const daysOverdue = calculateDaysOverdue(dueDate);
    
    // Amount is in cents, divide by 100
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

    // Step 6: Send text message
    await sendWhatsAppText(whatsappConfig, empresa.telefone, message);
    console.log('Text message sent');

    // Step 7: Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 8: Send PDF
    const pdfName = `boleto_${empresa.apelido || empresa.nome}_${competencia.replace('/', '_')}.pdf`;
    await sendWhatsAppDocument(whatsappConfig, empresa.telefone, pdfBase64, pdfName);
    console.log('PDF sent');

    return new Response(JSON.stringify({
      success: true,
      invoiceId,
      message: 'Boleto sent successfully',
      details: {
        empresa: empresa.nome,
        competencia,
        valor: amount,
        vencimento: formattedDueDate,
        isLate,
        daysOverdue,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Process boleto error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
