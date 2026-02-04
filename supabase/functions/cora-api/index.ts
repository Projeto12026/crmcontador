import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CORA_API_BASE = 'https://matls-clients.api.cora.com.br';

// Token cache
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
  // Check cache
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    console.log('Using cached Cora token');
    return tokenCache.token;
  }

  const clientId = Deno.env.get('CORA_CLIENT_ID');
  if (!clientId) {
    throw new Error('CORA_CLIENT_ID not configured');
  }

  const httpClient = createMTLSClient();

  console.log('Requesting new Cora token...');

  const response = await fetch(`${CORA_API_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
    }),
    client: httpClient,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Cora token error:', error);
    throw new Error(`Failed to get Cora token: ${response.status}`);
  }

  const data = await response.json();
  
  // Cache the token (with 5 minute buffer before expiry)
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  console.log('Cora token obtained successfully');
  return data.access_token;
}

async function searchInvoices(cnpj: string, start: string, end: string, page = 1, perPage = 100) {
  const token = await getCoraToken();
  const httpClient = createMTLSClient();

  const cleanCnpj = cnpj.replace(/\D/g, '');
  const url = `${CORA_API_BASE}/v2/invoices?search=${cleanCnpj}&start=${start}&end=${end}&page=${page}&perPage=${perPage}`;

  console.log('Searching invoices:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    client: httpClient,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Search invoices error:', error);
    throw new Error(`Failed to search invoices: ${response.status}`);
  }

  return response.json();
}

async function getInvoiceDetails(invoiceId: string) {
  const token = await getCoraToken();
  const httpClient = createMTLSClient();

  const url = `${CORA_API_BASE}/v2/invoices/${invoiceId}`;

  console.log('Getting invoice details:', invoiceId);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    client: httpClient,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Get invoice details error:', error);
    throw new Error(`Failed to get invoice details: ${response.status}`);
  }

  return response.json();
}

async function downloadPdf(pdfUrl: string): Promise<string> {
  console.log('Downloading PDF:', pdfUrl);

  const response = await fetch(pdfUrl);

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  return base64;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, cnpj, start, end, invoiceId, pdfUrl } = await req.json();

    console.log('Cora API action:', action);

    let result;

    switch (action) {
      case 'search_invoices':
        if (!cnpj || !start || !end) {
          throw new Error('cnpj, start and end are required');
        }
        result = await searchInvoices(cnpj, start, end);
        break;

      case 'get_details':
        if (!invoiceId) {
          throw new Error('invoiceId is required');
        }
        result = await getInvoiceDetails(invoiceId);
        break;

      case 'download_pdf':
        if (!pdfUrl) {
          throw new Error('pdfUrl is required');
        }
        const pdf = await downloadPdf(pdfUrl);
        result = { success: true, pdf, contentType: 'application/pdf' };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Cora API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
