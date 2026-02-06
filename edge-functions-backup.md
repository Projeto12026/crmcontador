# Backup das Edge Functions - CRM Contador
## Gerado em: 2026-02-06

---

## 1. sync-gclick-obligations/index.ts

Sincroniza obrigações de folha de pagamento com a API G-Click.

```typescript
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

  while (hasMore && page < 20) {
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
    const GCLICK_APP_KEY = Deno.env.get('GCLICK_APP_KEY');
    const GCLICK_APP_SECRET = Deno.env.get('GCLICK_APP_SECRET');
    
    if (!GCLICK_APP_KEY || !GCLICK_APP_SECRET) {
      throw new Error('Credenciais G-Click não configuradas');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json().catch(() => ({}));
    const { type = 'folha_pagamento' } = body;
    
    console.log(`Starting sync for: ${type}`);

    const accessToken = await getAccessToken(GCLICK_APP_KEY, GCLICK_APP_SECRET);

    const params: Record<string, string> = { categoria: 'Obrigacao' };
    if (type === 'folha_pagamento') params.nome = 'Folha de pagamento';

    const tasks = await fetchTasks(accessToken, params);
    console.log(`Fetched ${tasks.length} tasks`);

    let syncedCount = 0;

    for (const task of tasks) {
      const obligationData = {
        gclick_id: task.id,
        client_name: task.clienteApelido || 'Cliente',
        client_cnpj: task.clienteInscricao || '',
        client_status: 'Ativo',
        department: task.departamento?.nome || 'Departamento Pessoal',
        obligation_name: task.nome || 'Folha de pagamento',
        competence: formatCompetence(task.dataCompetencia || task.dataAcao),
        due_date: task.dataMeta || task.dataVencimento || null,
        status: mapStatus(task.status, task.dataMeta),
        completed_at: task.dataConclusao,
        updated_at: new Date().toISOString(),
      };

      const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/payroll_obligations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(obligationData),
      });

      if (upsertResponse.ok) {
        syncedCount++;
      } else {
        const errText = await upsertResponse.text();
        console.error(`Upsert error for ${task.id}:`, errText);
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
```

---

## 2. send-task-to-zapier/index.ts

Envia tarefas para o Zapier via webhook (integração com Google Tasks).

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskPayload {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
  status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { webhookUrl, task } = await req.json() as {
      webhookUrl: string;
      task: TaskPayload;
    };

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: "Webhook URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!task || !task.title) {
      return new Response(
        JSON.stringify({ error: "Task title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapierPayload = {
      title: task.title,
      notes: task.description || "",
      due: task.due_date || null,
      priority: task.priority || "medium",
      status: task.status || "pending",
      timestamp: new Date().toISOString(),
    };

    console.log("Sending task to Zapier webhook:", webhookUrl);
    console.log("Payload:", zapierPayload);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zapierPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Zapier webhook failed [${response.status}]:`, errorText);
      throw new Error(`Zapier webhook failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("Successfully sent task to Zapier");

    return new Response(
      JSON.stringify({ success: true, message: "Task sent to Zapier successfully", zapierResponse: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-task-to-zapier:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 3. receive-task-from-zapier/index.ts

Recebe tarefas do Zapier (Google Tasks → CRM).

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTaskPayload {
  title: string;
  notes?: string;
  due?: string;
  status?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: GoogleTaskPayload = await req.json();
    console.log('Received task from Zapier:', JSON.stringify(payload));

    if (!payload.title) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const taskStatus = payload.status === 'completed' ? 'completed' : 'pending';
    let dueDate: string | null = null;
    
    if (payload.due) {
      try {
        dueDate = new Date(payload.due).toISOString().split('T')[0];
      } catch (e) {
        console.warn('Could not parse due date:', payload.due);
      }
    }

    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('title', payload.title)
      .limit(1);

    if (existingTasks && existingTasks.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Task already exists', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        title: payload.title,
        description: payload.notes || null,
        due_date: dueDate,
        status: taskStatus,
        priority: 'medium',
        completed_at: taskStatus === 'completed' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, task: newTask }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Configuração (supabase/config.toml)

```toml
project_id = "rvekakbpmkemgiwkkdok"

[functions.sync-gclick-obligations]
verify_jwt = false

[functions.send-task-to-zapier]
verify_jwt = false

[functions.receive-task-from-zapier]
verify_jwt = false
```
