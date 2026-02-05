import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GCLICK_API_URL = 'https://api.gclick.com.br';

interface GClickTask {
  id: string;
  departamentoId: number;
  status: string;
  dataCriacao: string;
  dataCompetencia: string;
  dataAcao: string;
  dataMeta: string;
  dataVencimento: string;
  dataConclusao: string | null;
  nome: string;
  clienteId: number;
  clienteInscricao: string;
  clienteApelido: string;
  obrigacao: {
    id: number;
    nome: string;
    departamento: {
      id: number;
      nome: string;
    };
  };
  departamento: {
    id: number;
    nome: string;
  };
}

interface GClickResponse {
  content: GClickTask[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// Get OAuth2 access token
async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  console.log('Getting G-Click access token...');
  
  const response = await fetch(`${GCLICK_API_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to get access token:', response.status, errorText);
    throw new Error(`Falha na autenticação com G-Click: ${response.status}`);
  }

  const data = await response.json();
  console.log('Successfully obtained access token');
  return data.access_token;
}

// Fetch tasks from G-Click API
async function fetchTasks(accessToken: string, params: Record<string, string>): Promise<GClickTask[]> {
  const allTasks: GClickTask[] = [];
  let page = 0;
  let hasMore = true;
  const size = 100;

  while (hasMore) {
    const queryParams = new URLSearchParams({
      ...params,
      size: size.toString(),
      page: page.toString(),
    });

    console.log(`Fetching tasks page ${page}...`);
    
    const response = await fetch(`${GCLICK_API_URL}/tarefas?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch tasks:', response.status, errorText);
      throw new Error(`Falha ao buscar tarefas: ${response.status}`);
    }

    const data: GClickResponse = await response.json();
    console.log(`Page ${page}: ${data.content.length} tasks, total: ${data.totalElements}`);
    
    allTasks.push(...data.content);
    hasMore = !data.last;
    page++;

    // Safety limit
    if (page > 50) {
      console.warn('Reached page limit, stopping pagination');
      break;
    }
  }

  return allTasks;
}

// Map G-Click status to our status
function mapStatus(gclickStatus: string): 'pending' | 'delayed' | 'completed' {
  // Status mapping from documentation:
  // A = Aberto/Autorizada, S = Aguardando, C = Concluído, D = Dispensado, E = Retificando, O = Retificado
  switch (gclickStatus) {
    case 'C': // Concluído
    case 'D': // Dispensado
    case 'O': // Retificado
      return 'completed';
    case 'A': // Aberto
    case 'S': // Aguardando
    case 'E': // Retificando
    default:
      return 'pending';
  }
}

// Check if task is delayed (past due date)
function isDelayed(task: GClickTask): boolean {
  if (task.status === 'C' || task.status === 'D' || task.status === 'O') {
    return false; // Completed tasks are not delayed
  }
  
  const dueDate = task.dataMeta || task.dataVencimento;
  if (!dueDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  
  return due < today;
}

// Format competence from date
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
    const GCLICK_APP_KEY = Deno.env.get('GCLICK_APP_KEY');
    const GCLICK_APP_SECRET = Deno.env.get('GCLICK_APP_SECRET');
    
    if (!GCLICK_APP_KEY) {
      throw new Error('GCLICK_APP_KEY não configurado');
    }
    if (!GCLICK_APP_SECRET) {
      throw new Error('GCLICK_APP_SECRET não configurado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { type = 'folha_pagamento', departamentoId } = body;
    
    console.log(`Starting G-Click sync for type: ${type}`);

    // Get access token
    const accessToken = await getAccessToken(GCLICK_APP_KEY, GCLICK_APP_SECRET);

    // Build query params based on type
    const params: Record<string, string> = {
      categoria: 'Obrigacao',
    };

    // Filter by obligation name for "Folha de pagamento"
    if (type === 'folha_pagamento') {
      params.nome = 'Folha de pagamento';
    }

    // Optional: filter by department
    if (departamentoId) {
      params.departamentosIds = departamentoId.toString();
    }

    // Fetch all tasks
    const tasks = await fetchTasks(accessToken, params);
    console.log(`Fetched ${tasks.length} tasks from G-Click`);

    // Sync to database
    let syncedCount = 0;
    let errorCount = 0;

    for (const task of tasks) {
      try {
        const status = isDelayed(task) ? 'delayed' : mapStatus(task.status);
        
        const obligationData = {
          gclick_id: task.id,
          client_name: task.clienteApelido || 'Cliente não identificado',
          client_cnpj: task.clienteInscricao || '',
          client_status: 'Ativo',
          department: task.departamento?.nome || task.obrigacao?.departamento?.nome || 'Departamento Pessoal',
          obligation_name: task.nome || task.obrigacao?.nome || 'Folha de pagamento',
          competence: formatCompetence(task.dataCompetencia || task.dataAcao),
          due_date: task.dataMeta || task.dataVencimento || null,
          status: status,
          completed_at: task.dataConclusao ? new Date(task.dataConclusao).toISOString() : null,
          updated_at: new Date().toISOString(),
        };

        // Upsert by gclick_id
        const { error } = await supabase
          .from('payroll_obligations')
          .upsert(obligationData, { 
            onConflict: 'gclick_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`Error syncing task ${task.id}:`, error);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (taskError) {
        console.error(`Error processing task ${task.id}:`, taskError);
        errorCount++;
      }
    }

    console.log(`Sync completed. Synced: ${syncedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncedCount,
        errors: errorCount,
        total: tasks.length,
        message: `${syncedCount} obrigações sincronizadas com sucesso.${errorCount > 0 ? ` ${errorCount} erros.` : ''}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sync-gclick-obligations:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
