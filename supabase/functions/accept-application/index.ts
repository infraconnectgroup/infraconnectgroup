// Supabase Edge Function: accept-application
// Deploy: supabase functions deploy accept-application --no-verify-jwt
//
// Client: alleen header `apikey` (anon); JWT van de ingelogde admin in JSON-body `access_token`.
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
    const raw = await req.json();
    const access_token =
      typeof raw.access_token === "string" ? raw.access_token.trim() : "";
    if (!access_token) {
      return json({ error: "Missing access_token" }, 401);
    }

    const application_id_raw = raw.application_id ?? raw.applicationId;
    const admin_note = raw.admin_note;

    console.log(
      "[accept-application] application_id ontvangen:",
      JSON.stringify(application_id_raw),
      "type:",
      typeof application_id_raw,
    );

    if (application_id_raw == null || String(application_id_raw).trim() === "") {
      return json({ error: "Missing application_id" }, 400);
    }

    const application_id = String(application_id_raw).trim();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(application_id)) {
      console.warn("[accept-application] application_id is geen geldige UUID:", application_id);
      return json({ error: "Invalid application_id: verwacht UUID van kolom applications.id" }, 400);
    }

    // 1) Verify caller is admin — zelfde patroon als useAuth.ts: `user_roles` (geen RPC `has_role` in dit project)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${access_token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const uid = userData.user.id;
    const { data: roleRows, error: roleErr } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (roleErr) {
      console.warn("[accept-application] user_roles error:", roleErr.message);
      return json({ error: "Forbidden" }, 403);
    }
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    if (!isAdmin) {
      console.warn("[accept-application] geen admin-rol voor user", uid, "roles:", roles);
      return json({ error: "Forbidden" }, 403);
    }

    // 2) `applications`: zelfde JWT als admin-UI (RLS staat vaak alleen voor authenticated open;
    //    service_role mist soms GRANT → "permission denied for table applications").
    const { data: app, error: appErr } = await userClient
      .from("applications")
      .select("*")
      .eq("id", application_id)
      .single();
    if (appErr || !app) {
      console.warn("[accept-application] geen rij voor id:", application_id, appErr?.message);
      return json({ error: "Application not found" }, 404);
    }

    // 3) Service role alleen waar Auth Admin / brede rechten nodig is
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log("[accept-application] rij geladen, applications.id:", app.id);
    if (app.status === "accepted") return json({ error: "Already accepted" }, 409);

    const email: string = app.email;
    const fullName: string = app.full_name ?? app.contactpersoon ?? "";
    const companyName: string = app.company_name ?? app.bedrijfsnaam ?? "";
    const phone: string = app.phone ?? app.telefoon ?? "";
    const kvk: string = app.kvk_number ?? app.kvk_nummer ?? "";

    // 4) Create (or find) auth user
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

    // 5) Profiel — `service_role` heeft bij jullie geen GRANT op `profiles` (permission denied).
    //    Eerst service_role, dan zelfde JWT als admin-UI; blijft permission denied → niet blokkeren (trigger op
    //    auth.users of eerste portaal-login kan de rij alsnog vullen).
    const profileRow = { id: userId, full_name: fullName || null };
    let pr = await admin.from("profiles").upsert(profileRow, { onConflict: "id" });
    if (pr.error && /permission denied/i.test(pr.error.message)) {
      console.warn("[accept-application] profile service_role:", pr.error.message);
      pr = await userClient.from("profiles").upsert(profileRow, { onConflict: "id" });
    }
    if (pr.error) {
      if (/permission denied/i.test(pr.error.message)) {
        console.warn("[accept-application] profile overgeslagen (geen schrijfrechten):", pr.error.message);
      } else {
        return json({ error: `profile: ${pr.error.message}` }, 500);
      }
    }

    // 6) Assign 'lid' role (idempotent)
    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "lid" }, { onConflict: "user_id,role" });
    if (roleInsertErr) return json({ error: `role: ${roleInsertErr.message}` }, 500);

    // 7) Update application status — zelfde userClient + RLS als admin-pagina
    const candidates = ["accepted", "approved", "goedgekeurd", "geaccepteerd"];
    let updatedStatus: string | null = null;
    let lastErr: string | null = null;
    for (const s of candidates) {
      const { error: updErr } = await userClient
        .from("applications")
        .update({ status: s, admin_note: admin_note ?? app.admin_note ?? null })
        .eq("id", application_id);
      if (!updErr) { updatedStatus = s; break; }
      lastErr = updErr.message;
      // Only retry on check-constraint violations; otherwise fail fast.
      if (!/check constraint|violates/i.test(updErr.message)) break;
    }
    if (!updatedStatus) return json({ error: `application: ${lastErr}` }, 500);

    // 8) Send password setup email (recovery link)
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (linkErr) console.error("generateLink error:", linkErr.message);

    return json({ ok: true, user_id: userId, status: updatedStatus });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
