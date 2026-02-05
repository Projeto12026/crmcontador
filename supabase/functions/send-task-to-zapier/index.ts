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
  // Handle CORS preflight
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

    // Format the payload for Google Tasks via Zapier
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(zapierPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Zapier webhook failed [${response.status}]:`, errorText);
      throw new Error(
        `Zapier webhook failed with status ${response.status}: ${errorText}`
      );
    }

    const result = await response.json();

    console.log("Successfully sent task to Zapier");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Task sent to Zapier successfully",
        zapierResponse: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-task-to-zapier:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
