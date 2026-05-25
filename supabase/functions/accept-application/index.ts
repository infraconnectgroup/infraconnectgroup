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
    const profileRow = {
      id: userId,
      full_name: fullName || null,
      company_name: companyName || null,
      phone: phone || null,
      kvk_number: kvk || null,
    };
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

    // 8) Generate password setup link + send branded onboarding email
    const SITE_URL = Deno.env.get("SITE_URL") ?? "https://businessclub-alislah.nl";
    const redirectTo = `${SITE_URL.replace(/\/$/, "")}/reset-password`;
    // Recovery werkt voor bestaande auth-users (invite faalt zodra de user bestaat).
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkErr) console.error("generateLink recovery error:", linkErr.message, "redirectTo:", redirectTo);

    const actionLink =
      linkData?.properties?.action_link ??
      `${SITE_URL}/login`;
    if (!linkData?.properties?.action_link) {
      console.warn("[accept-application] geen action_link uit generateLink — fallback naar /login");
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    let emailError: string | null = null;

    if (RESEND_API_KEY) {
      const html = renderOnboardingEmail({
        fullName,
        companyName,
        actionLink,
        siteUrl: SITE_URL,
      });
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Businessclub Al Islah <info@businessclub-alislah.nl>",
            to: [email],
            subject: "Welkom bij Businessclub Al Islah — stel je wachtwoord in",
            html,
          }),
        });
        if (!res.ok) {
          emailError = `resend ${res.status}: ${await res.text()}`;
          console.error(emailError);
        } else {
          emailSent = true;
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : "resend failed";
        console.error(emailError);
      }
    } else {
      emailError = "RESEND_API_KEY not configured";
      console.warn("[accept-application]", emailError);
    }

    return json({
      ok: true,
      user_id: userId,
      status: updatedStatus,
      email_sent: emailSent,
      email_error: emailError,
      action_link: emailSent ? undefined : actionLink,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

// ---------- Branded onboarding email template ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface OnboardingEmailData {
  fullName: string;
  companyName: string;
  actionLink: string;
  siteUrl: string;
}

function renderOnboardingEmail(d: OnboardingEmailData): string {
  const name = d.fullName?.trim() || "ondernemer";
  const company = d.companyName?.trim() || "";
  const logoUrl = `${d.siteUrl.replace(/\/$/, "")}/logo-alislah.png`;
  const safeName = escapeHtml(name);
  const safeCompany = escapeHtml(company);
  const safeLink = escapeHtml(d.actionLink);
  const safeSite = escapeHtml(d.siteUrl);

  // Brand colors (mirror src/styles.css)
  const primary = "#248eb7";
  const accent = "#bd8d2b";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Welkom bij Businessclub Al Islah</title>
<!--[if mso]>
<style type="text/css">
  body, table, td { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Welkom bij Businessclub Al Islah — stel je wachtwoord in en activeer je lidmaatschap.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <!-- Logo header -->
          <tr>
            <td align="center" style="padding:8px 0 24px 0;">
              <img src="${escapeHtml(logoUrl)}" width="100" height="100" alt="Businessclub Al Islah"
                style="display:block;border:0;outline:none;text-decoration:none;width:100px;height:100px;border-radius:12px;" />
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${primary};margin-top:12px;font-weight:700;letter-spacing:0.3px;">
                Businessclub Al Islah
              </div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);padding:40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="display:inline-block;background-color:#fdf3df;color:${accent};font-family:Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">
                      Aanmelding goedgekeurd
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:16px 0 8px 0;">
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#0f172a;font-weight:700;">
                      Welkom ${safeName},
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 0 24px 0;">
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#475569;">
                      We zijn verheugd ${safeCompany ? `<strong style="color:#0f172a;">${safeCompany}</strong> en jou ` : "je "}te mogen verwelkomen bij Businessclub Al Islah — het netwerk voor ondernemers met islamitische waarden. Stel hieronder je wachtwoord in om direct toegang te krijgen tot het ledenportaal.
                    </p>
                  </td>
                </tr>
                <!-- CTA -->
                <tr>
                  <td align="center" style="padding:8px 0 24px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${primary}" style="border-radius:10px;">
                          <a href="${safeLink}"
                            style="display:inline-block;padding:16px 32px;font-family:Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:${primary};">
                            Wachtwoord instellen
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 8px 0;">
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#64748b;line-height:1.6;">
                      Werkt de knop niet? Kopieer en plak deze link in je browser:<br/>
                      <a href="${safeLink}" style="color:${primary};word-break:break-all;">${safeLink}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 0 8px 0;">
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0 0;">
                    <p style="margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:14px;color:#0f172a;font-weight:600;">
                      Wat kun je verwachten?
                    </p>
                    <ul style="margin:0;padding-left:20px;font-family:Arial,sans-serif;font-size:14px;color:#475569;line-height:1.7;">
                      <li>Toegang tot exclusieve netwerkbijeenkomsten</li>
                      <li>Een ledenportaal met agenda en contacten</li>
                      <li>Verbinding met gelijkgestemde ondernemers</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Security note -->
          <tr>
            <td style="padding:20px 16px 8px 16px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
                Deze link is persoonlijk en blijft 24 uur geldig. Heb jij geen aanmelding gedaan?
                Negeer deze e-mail of neem contact met ons op.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 16px 8px 16px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#64748b;line-height:1.6;">
                <strong style="color:#0f172a;">Businessclub Al Islah</strong><br/>
                <a href="${safeSite}" style="color:${primary};text-decoration:none;">${safeSite.replace(/^https?:\/\//, "")}</a>
                &nbsp;·&nbsp;
                <a href="mailto:info@businessclub-alislah.nl" style="color:${primary};text-decoration:none;">info@businessclub-alislah.nl</a>
              </p>
              <p style="margin:12px 0 0 0;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;">
                © ${new Date().getFullYear()} Businessclub Al Islah. Alle rechten voorbehouden.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
