import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GCLICK_API_URL = 'https://api.gclick.com.br';

interface GClickTask {
  id: string;
  status: string;
  dataCompetencia: string;
  dataAcao: string;
  dataMeta: string;
  dataVencimento: string;
  dataConclusao: string | null;
  nome: string;
  clienteInscricao: string;
  clienteApelido: string;
  obrigacao?: { nome: string; departamento?: { nome: string } };
  departamento?: { nome: string };
}

interface GClickResponse {
  content: GClickTask[];
  last: boolean;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  console.log('Getting G-Click access token...');
  
  const response = await fetch(`${GCLICK_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Auth failed:', response.status, errorText);
    throw new Error(`Falha na autenticação: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchTasks(accessToken: string, params: Record<string, string>): Promise<GClickTask[]> {
  const allTasks: GClickTask[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < 100) {
    const queryParams = new URLSearchParams({ ...params, size: '100', page: page.toString() });
    
    const response = await fetch(`${GCLICK_API_URL}/tarefas?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fetch failed:', response.status, errorText);
      throw new Error(`Falha ao buscar tarefas: ${response.status}`);
    }

    const data: GClickResponse = await response.json();
    allTasks.push(...data.content);
    hasMore = !data.last;
    page++;
  }

  return allTasks;
}

function mapStatus(status: string, dataMeta: string): string {
  if (['C', 'D', 'O'].includes(status)) return 'completed';
  
  if (dataMeta) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(dataMeta) < today) return 'delayed';
  }
  
  return 'pending';
}

function formatCompetence(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  return `${months[date.getMonth()]}/${date.getFullYear()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Try env vars first, then fall back to settings table
    let GCLICK_APP_KEY = Deno.env.get('GCLICK_APP_KEY');
    let GCLICK_APP_SECRET = Deno.env.get('GCLICK_APP_SECRET');
    
    if (!GCLICK_APP_KEY || !GCLICK_APP_SECRET) {
      console.log('Env vars not found, checking settings table...');
      const settingsRes = await fetch(
        `${supabaseUrl}/rest/v1/settings?key=eq.gclick_credentials&select=value`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
        }
      );
      if (settingsRes.ok) {
        const rows = await settingsRes.json();
        if (rows.length > 0 && rows[0].value) {
          GCLICK_APP_KEY = rows[0].value.app_key || GCLICK_APP_KEY;
          GCLICK_APP_SECRET = rows[0].value.app_secret || GCLICK_APP_SECRET;
        }
      }
    }
    
    if (!GCLICK_APP_KEY || !GCLICK_APP_SECRET) {
      throw new Error('Credenciais G-Click não configuradas. Configure na página de Configurações.');
    }

    const body = await req.json().catch(() => ({}));
    const { type = 'folha_pagamento' } = body;
    
    console.log(`Starting sync for: ${type}`);

    const accessToken = await getAccessToken(GCLICK_APP_KEY, GCLICK_APP_SECRET);

    const params: Record<string, string> = { categoria: 'Obrigacao' };
    if (type === 'folha_pagamento') params.departamento = 'Departamento Pessoal';

    const allTasks = await fetchTasks(accessToken, params);
    console.log(`Fetched ${allTasks.length} tasks from API`);

    // Log sample tasks to debug structure
    if (allTasks.length > 0) {
      const sample = allTasks.slice(0, 3).map(t => ({
        id: t.id, nome: t.nome,
        departamento: t.departamento,
        obrigacao: t.obrigacao,
        keys: Object.keys(t),
      }));
      console.log('Sample tasks:', JSON.stringify(sample));
    }

    // Filter by department - check both departamento and obrigacao.departamento
    const tasks = type === 'folha_pagamento' 
      ? allTasks.filter(t => {
          const dept = t.departamento?.nome || t.obrigacao?.departamento?.nome || '';
          return dept.toLowerCase().includes('pessoal');
        })
      : allTasks;
    console.log(`After department filter: ${tasks.length} tasks`);

    // Map all tasks to obligation data
    const obligations = tasks.map(task => ({
      gclick_id: task.id,
      client_name: task.clienteApelido || 'Cliente',
      client_cnpj: task.clienteInscricao || '',
      client_status: 'Ativo',
      department: task.departamento?.nome || 'Departamento Pessoal',
      obligation_name: task.obrigacao?.nome || task.nome || 'Sem nome',
      competence: formatCompetence(task.dataCompetencia || task.dataAcao),
      due_date: task.dataMeta || task.dataVencimento || null,
      status: mapStatus(task.status, task.dataMeta),
      completed_at: task.dataConclusao,
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert in chunks of 200
    let syncedCount = 0;
    const chunkSize = 200;
    for (let i = 0; i < obligations.length; i += chunkSize) {
      const chunk = obligations.slice(i, i + chunkSize);
      const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/payroll_obligations?on_conflict=gclick_id`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(chunk),
      });

      if (upsertResponse.ok) {
        syncedCount += chunk.length;
      } else {
        const errText = await upsertResponse.text();
        console.error(`Batch upsert error (chunk ${i / chunkSize}):`, errText);
      }
    }

    console.log(`Synced: ${syncedCount}/${tasks.length}`);

    return new Response(
      JSON.stringify({ success: true, synced: syncedCount, total: tasks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
