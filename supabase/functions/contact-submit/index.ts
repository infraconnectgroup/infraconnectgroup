// Supabase Edge Function: contact-submit
// Deploy: supabase functions deploy contact-submit --no-verify-jwt
//
// Secrets:
//   RESEND_API_KEY          — Resend API key (required)
//   CONTACT_NOTIFY_EMAIL    — optioneel: ander ontvanger-adres (default bcislah@gmail.com)
//   CONTACT_NOTIFY_NAME     — optioneel: naam bij ontvanger
//   CONTACT_FROM_EMAIL      — optioneel: override afzender (default branded)
//
// Runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

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

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 4000;

const DEFAULT_NOTIFY_EMAIL = "bcislah@gmail.com";
const DEFAULT_FROM = "Businessclub Al Islah <info@businessclub-alislah.nl>";
const SITE_URL = "https://businessclub-alislah.nl";

function trimStr(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t || t.length > max) return null;
  return t;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const name = trimStr(body.name, MAX_NAME);
    const email = trimStr(body.email, MAX_EMAIL);
    const message = trimStr(body.message, MAX_MESSAGE);
    if (!name || !email || !message) return json({ error: "Ongeldige invoer" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Ongeldig e-mailadres" }, 400);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[contact-submit] Missing RESEND_API_KEY");
      return json({ error: "E-mailservice is niet geconfigureerd op de server." }, 503);
    }

    const fromAddress = Deno.env.get("CONTACT_FROM_EMAIL")?.trim() || DEFAULT_FROM;
    const notifyEmail = Deno.env.get("CONTACT_NOTIFY_EMAIL")?.trim() || DEFAULT_NOTIFY_EMAIL;
    const notifyName = Deno.env.get("CONTACT_NOTIFY_NAME")?.trim();
    const notifyTo = notifyName ? `${notifyName} <${notifyEmail}>` : notifyEmail;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const subject = `Contactformulier — ${name}`;
    const text = [
      "Nieuw bericht via het contactformulier van Businessclub Al Islah",
      "",
      `Naam:    ${name}`,
      `E-mail:  ${email}`,
      "",
      "Bericht:",
      message,
      "",
      "—",
      "Reageer rechtstreeks op deze e-mail om de afzender te bereiken.",
    ].join("\n");
    const html = renderContactEmail({ name, email, message });

    console.log("[contact-submit] sending", { from: fromAddress, to: notifyTo, replyTo: email });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: notifyTo,
        reply_to: email,
        subject,
        text,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[contact-submit] Resend error:", resendRes.status, errText);
      return json({ error: "E-mail kon niet worden verzonden." }, 502);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: insertErr } = await admin.from("contact_messages").insert({ name, email, message });
    if (insertErr) {
      console.error("[contact-submit] Insert error:", insertErr);
      return json({ error: "Bericht kon niet worden opgeslagen." }, 500);
    }

    console.log("[contact-submit] success");
    return json({ ok: true });
  } catch (e) {
    console.error("[contact-submit] Unexpected error:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

// ---------- Branded contact notification email ----------

interface ContactEmailData {
  name: string;
  email: string;
  message: string;
}

function renderContactEmail(d: ContactEmailData): string {
  const safeName = escapeHtml(d.name);
  const safeEmail = escapeHtml(d.email);
  const safeMessage = escapeHtml(d.message).replace(/\n/g, "<br/>");
  const logoUrl = `${SITE_URL}/logo-alislah.png`;

  const primary = "#248eb7";
  const accent = "#bd8d2b";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Nieuw contactbericht</title>
<!--[if mso]>
<style type="text/css">body, table, td { font-family: Arial, sans-serif !important; }</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Nieuw bericht via het contactformulier van ${safeName}.
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
            <td style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);padding:32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="display:inline-block;background-color:#fdf3df;color:${accent};font-family:Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">
                      Nieuw contactbericht
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:16px 0 24px 0;">
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#0f172a;font-weight:700;">
                      Bericht via het contactformulier
                    </h1>
                  </td>
                </tr>
                <!-- Details table -->
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                      <tr>
                        <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
                          <div style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px;">Naam</div>
                          <div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;font-weight:600;">${safeName}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 18px;">
                          <div style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px;">E-mail</div>
                          <div style="font-family:Arial,sans-serif;font-size:15px;">
                            <a href="mailto:${safeEmail}" style="color:${primary};text-decoration:none;font-weight:600;">${safeEmail}</a>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Message -->
                <tr>
                  <td style="padding:8px 0 0 0;">
                    <div style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:8px;">Bericht</div>
                    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;background-color:#ffffff;border-left:3px solid ${primary};padding:14px 18px;border-radius:6px;background-color:#f8fafc;">
                      ${safeMessage}
                    </div>
                  </td>
                </tr>
                <!-- CTA -->
                <tr>
                  <td align="center" style="padding:24px 0 4px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${primary}" style="border-radius:10px;">
                          <a href="mailto:${safeEmail}"
                            style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:${primary};">
                            Beantwoord ${safeName}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 0 0 0;">
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;">
                      Of beantwoord deze e-mail rechtstreeks — reply-to is ingesteld op de afzender.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 16px 8px 16px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#64748b;line-height:1.6;">
                <strong style="color:#0f172a;">Businessclub Al Islah</strong><br/>
                <a href="${SITE_URL}" style="color:${primary};text-decoration:none;">businessclub-alislah.nl</a>
                &nbsp;·&nbsp;
                <a href="mailto:info@businessclub-alislah.nl" style="color:${primary};text-decoration:none;">info@businessclub-alislah.nl</a>
              </p>
              <p style="margin:12px 0 0 0;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;">
                © ${new Date().getFullYear()} Businessclub Al Islah · Automatische notificatie
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
