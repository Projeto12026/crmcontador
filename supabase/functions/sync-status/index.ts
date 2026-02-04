import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CORA_API_BASE = 'https://matls-clients.api.cora.com.br';

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

async function getInvoiceStatus(cnpj: string, competencia: string) {
  const token = await getCoraToken();
  const httpClient = createMTLSClient();

  // Parse competencia (MM/AAAA)
  const [month, year] = competencia.split('/');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const cleanCnpj = cnpj.replace(/\D/g, '');
  const url = `${CORA_API_BASE}/v2/invoices?search=${cleanCnpj}&start=${startDate}&end=${endDate}&page=1&perPage=10`;

  console.log('Checking invoice status for:', cleanCnpj);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    client: httpClient,
  });

  if (!response.ok) {
    throw new Error(`Failed to get invoice status: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    return { status: 'UNKNOWN', amount: null };
  }

  const invoice = data.items[0];
  
  // Map Cora status to our status
  let status = 'UNKNOWN';
  switch (invoice.status?.toUpperCase()) {
    case 'OPEN':
      status = 'OPEN';
      break;
    case 'LATE':
    case 'OVERDUE':
      status = 'LATE';
      break;
    case 'PAID':
      status = 'PAID';
      break;
    case 'CANCELLED':
    case 'CANCELED':
      status = 'CANCELLED';
      break;
    default:
      status = 'UNKNOWN';
  }

  // Amount is in cents
  const amount = invoice.total_amount ? invoice.total_amount / 100 : null;

  return { status, amount, invoiceId: invoice.id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, empresaId, cnpj, competencia } = await req.json();

    if (action === 'sync_all') {
      // Sync all empresas
      const { data: empresas, error: fetchError } = await supabase
        .from('empresas')
        .select('id, cnpj')
        .not('cnpj', 'is', null);

      if (fetchError) throw fetchError;

      let processed = 0;
      let updated = 0;
      let errors = 0;

      for (const empresa of empresas || []) {
        try {
          const result = await getInvoiceStatus(empresa.cnpj, competencia);
          
          const { error: updateError } = await supabase
            .from('empresas')
            .update({
              status: result.status,
              amount: result.amount,
              last_sync: new Date().toISOString(),
              last_status_update: new Date().toISOString(),
            })
            .eq('id', empresa.id);

          if (updateError) {
            errors++;
          } else {
            updated++;
          }
          processed++;
        } catch (err) {
          console.error(`Error syncing empresa ${empresa.id}:`, err);
          errors++;
          processed++;
          
          // Mark as error
          await supabase
            .from('empresas')
            .update({
              status: 'ERRO_CONSULTA',
              last_sync: new Date().toISOString(),
            })
            .eq('id', empresa.id);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processed,
        updated,
        errors,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single empresa sync
    if (!empresaId || !cnpj || !competencia) {
      throw new Error('empresaId, cnpj and competencia are required');
    }

    const result = await getInvoiceStatus(cnpj, competencia);

    // Update empresa
    const { error: updateError } = await supabase
      .from('empresas')
      .update({
        status: result.status,
        amount: result.amount,
        last_sync: new Date().toISOString(),
        last_status_update: new Date().toISOString(),
      })
      .eq('id', empresaId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      success: true,
      ...result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Sync status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
