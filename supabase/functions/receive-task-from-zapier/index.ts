import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTaskPayload {
  title: string;
  notes?: string;
  due?: string;
  status?: string;
  google_task_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming webhook payload from Zapier
    const payload: GoogleTaskPayload = await req.json();
    console.log('Received task from Zapier:', JSON.stringify(payload));

    if (!payload.title) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map Google Tasks status to our status
    let taskStatus: 'pending' | 'completed' = 'pending';
    if (payload.status === 'completed') {
      taskStatus = 'completed';
    }

    // Parse due date if provided
    let dueDate: string | null = null;
    if (payload.due) {
      try {
        // Google Tasks due date format is typically ISO 8601
        dueDate = new Date(payload.due).toISOString().split('T')[0];
      } catch (e) {
        console.warn('Could not parse due date:', payload.due);
      }
    }

    // Check if task already exists (by title to avoid duplicates)
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('title', payload.title)
      .limit(1);

    if (existingTasks && existingTasks.length > 0) {
      console.log('Task already exists, skipping:', payload.title);
      return new Response(
        JSON.stringify({ success: true, message: 'Task already exists', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the new task
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

    if (error) {
      console.error('Error inserting task:', error);
      throw error;
    }

    console.log('Task created successfully:', newTask.id);

    return new Response(
      JSON.stringify({ success: true, task: newTask }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
