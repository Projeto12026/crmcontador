import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function getWhatsAppConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('ativo', true)
    .single();

  if (error || !data) {
    throw new Error('WhatsApp config not found or not active');
  }

  return data;
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
  } catch (err: unknown) {
    if (retries > 0) {
      console.log(`Request failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // Add Brazil country code if not present
  if (cleaned.length === 11) {
    cleaned = '55' + cleaned;
  } else if (cleaned.length === 10) {
    cleaned = '55' + cleaned;
  }
  
  // Ensure it has 13 digits (55 + DDD + 9 digits)
  if (cleaned.length !== 13) {
    console.warn(`Phone number has unexpected length: ${cleaned.length}`);
  }
  
  return cleaned;
}

async function sendText(token: string, apiUrl: string, phone: string, message: string) {
  const formattedPhone = formatPhone(phone);
  const url = `${apiUrl}/api/enviar-texto/${token}`;

  console.log('Sending text to:', formattedPhone);

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone: formattedPhone, message }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Send text error:', error);
    throw new Error(`Failed to send text: ${response.status}`);
  }

  return response.json();
}

async function sendDocument(token: string, apiUrl: string, phone: string, base64: string, name: string) {
  const formattedPhone = formatPhone(phone);
  const url = `${apiUrl}/api/enviar-documento/${token}`;

  console.log('Sending document to:', formattedPhone);

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: formattedPhone,
      base64: `data:application/pdf;base64,${base64}`,
      name,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Send document error:', error);
    throw new Error(`Failed to send document: ${response.status}`);
  }

  return response.json();
}

async function testConnection(token: string, apiUrl: string) {
  // Try to make a simple request to verify the connection
  const url = `${apiUrl}/api/status/${token}`;
  
  try {
    const response = await fetch(url, { method: 'GET' });
    return { success: response.ok, status: response.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, phone, message, base64, name, token: customToken, apiUrl: customApiUrl } = await req.json();

    console.log('WhatsApp API action:', action);

    let config;
    let token: string;
    let apiUrl: string;

    if (customToken && customApiUrl) {
      token = customToken;
      apiUrl = customApiUrl;
    } else {
      config = await getWhatsAppConfig();
      token = config.token;
      apiUrl = config.api_url;
    }

    let result;

    switch (action) {
      case 'send_text':
        if (!phone || !message) {
          throw new Error('phone and message are required');
        }
        result = await sendText(token, apiUrl, phone, message);
        break;

      case 'send_document':
        if (!phone || !base64 || !name) {
          throw new Error('phone, base64 and name are required');
        }
        result = await sendDocument(token, apiUrl, phone, base64, name);
        break;

      case 'test_connection':
        result = await testConnection(token, apiUrl);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('WhatsApp API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
