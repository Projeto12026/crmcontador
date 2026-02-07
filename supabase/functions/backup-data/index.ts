import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "clients",
  "client_contacts",
  "client_onboarding",
  "client_onboarding_items",
  "contracts",
  "contract_services",
  "financial_accounts",
  "financial_categories",
  "financial_transactions",
  "cash_flow_transactions",
  "account_categories",
  "leads",
  "lead_activities",
  "tasks",
  "processes",
  "process_steps",
  "process_templates",
  "process_template_steps",
  "onboarding_templates",
  "onboarding_template_items",
  "payroll_obligations",
  "settings",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read all data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the user is authenticated
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        errors.push(`${table}: ${error.message}`);
        backup[table] = [];
      } else {
        backup[table] = data || [];
      }
    }

    const result = {
      backup_date: new Date().toISOString(),
      backup_by: user.email,
      tables: backup,
      table_counts: Object.fromEntries(
        Object.entries(backup).map(([k, v]) => [k, v.length])
      ),
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
