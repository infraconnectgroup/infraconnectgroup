// Supabase Edge Function: send-password-reset
// Deploy: supabase functions deploy send-password-reset --no-verify-jwt
//
// Verstuurt een gebrande "wachtwoord herstellen"-mail (zelfde stijl als de
// onboarding-mail uit accept-application). De recovery-link wordt server-side
// gegenereerd via de Admin API, zodat we niet afhankelijk zijn van de
// standaard Supabase Auth e-mailtemplate.
//
// Body: { email: string }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
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
    const { email: rawEmail } = await req.json();
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Ongeldig e-mailadres" }, 400);
    }

    const SITE_URL = Deno.env.get("SITE_URL") ?? "https://businessclub-alislah.nl";
    const redirectTo = `${SITE_URL.replace(/\/$/, "")}/reset-password`;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Genereer recovery-link via Admin API
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    // Voor veiligheid (geen account-enumeratie): geef altijd ok terug,
    // ook als het e-mailadres niet bestaat.
    if (linkErr || !linkData?.properties?.action_link) {
      console.warn("[send-password-reset] generateLink:", linkErr?.message);
      return json({ ok: true });
    }

    const actionLink = linkData.properties.action_link;

    // Probeer de naam uit het profiel te halen voor een persoonlijke aanhef
    let fullName = "";
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const u = list?.users?.find((x) => x.email?.toLowerCase() === email);
      fullName =
        (u?.user_metadata?.full_name as string | undefined) ??
        (u?.user_metadata?.name as string | undefined) ??
        "";
    } catch (_) { /* niet kritiek */ }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("[send-password-reset] RESEND_API_KEY ontbreekt");
      return json({ ok: true, email_sent: false, action_link: actionLink });
    }

    const html = renderResetEmail({ fullName, actionLink, siteUrl: SITE_URL });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Businessclub Al Islah <info@businessclub-alislah.nl>",
        to: [email],
        subject: "Wachtwoord herstellen — Businessclub Al Islah",
        html,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[send-password-reset] resend", res.status, txt);
      return json({ ok: true, email_sent: false });
    }

    return json({ ok: true, email_sent: true });
  } catch (e) {
    console.error("[send-password-reset]", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

// ---------- Branded reset email template ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ResetEmailData {
  fullName: string;
  actionLink: string;
  siteUrl: string;
}

function renderResetEmail(d: ResetEmailData): string {
  const name = d.fullName?.trim() || "";
  const greeting = name ? `Hallo ${escapeHtml(name)},` : "Hallo,";
  const logoUrl = `${d.siteUrl.replace(/\/$/, "")}/logo-alislah.png`;
  const safeLink = escapeHtml(d.actionLink);
  const safeSite = escapeHtml(d.siteUrl);

  const primary = "#248eb7";
  const accent = "#bd8d2b";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Wachtwoord herstellen — Businessclub Al Islah</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Stel een nieuw wachtwoord in voor je Businessclub Al Islah account.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:8px 0 24px 0;">
              <img src="${escapeHtml(logoUrl)}" width="100" height="100" alt="Businessclub Al Islah"
                style="display:block;border:0;outline:none;text-decoration:none;width:100px;height:100px;border-radius:12px;" />
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${primary};margin-top:12px;font-weight:700;letter-spacing:0.3px;">
                Businessclub Al Islah
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);padding:40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="display:inline-block;background-color:#fdf3df;color:${accent};font-family:Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">
                      Wachtwoord herstellen
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:16px 0 8px 0;">
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#0f172a;font-weight:700;">
                      Stel een nieuw wachtwoord in
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:20px 0 8px 0;">
                    <p style="margin:0 0 12px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#0f172a;font-weight:600;">
                      ${greeting}
                    </p>
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#475569;">
                      We ontvingen een verzoek om het wachtwoord van je Businessclub Al Islah account opnieuw in te stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:24px 0 24px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${primary}" style="border-radius:10px;">
                          <a href="${safeLink}"
                            style="display:inline-block;padding:16px 32px;font-family:Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:${primary};">
                            Wachtwoord opnieuw instellen
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
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#64748b;line-height:1.6;">
                      Heb jij geen wachtwoordherstel aangevraagd? Dan kun je deze e-mail gerust negeren — je wachtwoord blijft ongewijzigd.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 16px 8px 16px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
                Deze link is persoonlijk en blijft 60 minuten geldig.
              </p>
            </td>
          </tr>
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
