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
