// Supabase Edge Function: accept-application
// Deploy via: supabase functions deploy accept-application --no-verify-jwt=false
//
// Required env (already present in Supabase Edge Functions runtime):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { application_id, admin_note } = await req.json();
    if (!application_id) return json({ error: "Missing application_id" }, 400);

    // 1) Verify caller is admin (uses caller's JWT + RLS / has_role)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

    // 2) Admin client (service role bypasses RLS)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Load application
    const { data: app, error: appErr } = await admin
      .from("applications")
      .select("*")
      .eq("id", application_id)
      .single();
    if (appErr || !app) return json({ error: "Application not found" }, 404);
    if (app.status === "accepted") return json({ error: "Already accepted" }, 409);

    const email: string = app.email;
    const fullName: string = app.full_name ?? app.contactpersoon ?? "";
    const companyName: string = app.company_name ?? app.bedrijfsnaam ?? "";
    const phone: string = app.phone ?? app.telefoon ?? "";
    const kvk: string = app.kvk_number ?? app.kvk_nummer ?? "";

    // 3) Create (or find) auth user
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, company_name: companyName },
    });

    if (createErr) {
      // If user already exists, look them up via listUsers
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) return json({ error: createErr.message }, 500);
      userId = existing.id;
    } else {
      userId = created.user?.id ?? null;
    }
    if (!userId) return json({ error: "Failed to resolve user id" }, 500);

    // 4) Upsert profile
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      company_name: companyName,
      phone,
      kvk_number: kvk,
    });
    if (profileErr) return json({ error: `profile: ${profileErr.message}` }, 500);

    // 5) Assign 'lid' role (idempotent)
    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "lid" }, { onConflict: "user_id,role" });
    if (roleInsertErr) return json({ error: `role: ${roleInsertErr.message}` }, 500);

    // 6) Update application status
    const { error: updErr } = await admin
      .from("applications")
      .update({ status: "accepted", admin_note: admin_note ?? app.admin_note ?? null })
      .eq("id", application_id);
    if (updErr) return json({ error: `application: ${updErr.message}` }, 500);

    // 7) Send password setup email (recovery link)
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (linkErr) console.error("generateLink error:", linkErr.message);

    return json({ ok: true, user_id: userId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
