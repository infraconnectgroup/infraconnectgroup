// Supabase Edge Function: list-members
// Deploy: supabase functions deploy list-members
//
// Returns members (profiles) joined with auth.users.email.
// Requires a valid logged-in user (verifies JWT) — only members can call.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Verify caller is authenticated
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id,full_name,company_name,avatar_url,bio,phone")
      .order("full_name", { ascending: true });
    if (pErr) return json({ error: pErr.message }, 500);

    // Fetch emails from auth.users
    const emailMap = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (lErr) return json({ error: lErr.message }, 500);
      for (const u of list.users) if (u.email) emailMap.set(u.id, u.email);
      if (!list.users.length || list.users.length < 1000) break;
      page++;
    }

    const members = (profiles ?? []).map((p) => ({ ...p, email: emailMap.get(p.id) ?? null }));
    return json({ members });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
