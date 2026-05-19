// Supabase Edge Function: application-notify
// Stuurt een notificatiemail naar de admin bij een nieuwe lidmaatschapsaanvraag.
//
// Secrets:
//   RESEND_API_KEY          — Resend API key (required)
//   CONTACT_NOTIFY_EMAIL    — optioneel: ander ontvanger-adres (default bcislah@gmail.com)
//   CONTACT_NOTIFY_NAME     — optioneel: naam bij ontvanger
//   CONTACT_FROM_EMAIL      — optioneel: override afzender (default branded)

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

const DEFAULT_NOTIFY_EMAIL = "bcislah@gmail.com";
const DEFAULT_FROM = "Businessclub Al Islah <info@businessclub-alislah.nl>";
const SITE_URL = "https://businessclub-alislah.nl";
const ADMIN_URL = `${SITE_URL}/admin`;

function trimStr(s: unknown, max = 4000): string {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
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
    const data = {
      company_name: trimStr(body.company_name, 200),
      full_name: trimStr(body.full_name, 200),
      email: trimStr(body.email, 320),
      phone: trimStr(body.phone, 50),
      kvk_number: trimStr(body.kvk_number, 50),
      motivation: trimStr(body.motivation, 4000),
      membership_tier: trimStr(body.membership_tier, 50),
      created_at: trimStr(body.created_at, 50) || new Date().toISOString(),
    };

    if (!data.company_name || !data.full_name || !data.email) {
      return json({ error: "Ongeldige invoer" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[application-notify] Missing RESEND_API_KEY");
      return json({ error: "E-mailservice is niet geconfigureerd." }, 503);
    }

    const fromAddress = Deno.env.get("CONTACT_FROM_EMAIL")?.trim() || DEFAULT_FROM;
    const notifyEmail = Deno.env.get("CONTACT_NOTIFY_EMAIL")?.trim() || DEFAULT_NOTIFY_EMAIL;
    const notifyName = Deno.env.get("CONTACT_NOTIFY_NAME")?.trim();
    const notifyTo = notifyName ? `${notifyName} <${notifyEmail}>` : notifyEmail;

    const subject = `Nieuwe lidmaatschapsaanvraag – ${data.company_name}`;

    const dateFmt = (() => {
      try {
        return new Date(data.created_at).toLocaleString("nl-NL", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Amsterdam",
        });
      } catch {
        return data.created_at;
      }
    })();

    const text = [
      "Nieuwe lidmaatschapsaanvraag ontvangen",
      "",
      `Bedrijfsnaam:   ${data.company_name}`,
      `Naam:           ${data.full_name}`,
      `E-mail:         ${data.email}`,
      `Telefoon:       ${data.phone}`,
      `KVK:            ${data.kvk_number}`,
      `Lidmaatschap:   ${data.membership_tier}`,
      "",
      "Motivatie:",
      data.motivation,
      "",
      `Datum aanvraag: ${dateFmt}`,
      "",
      `Open adminportaal: ${ADMIN_URL}`,
    ].join("\n");

    const html = renderEmail({ ...data, dateFmt });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: notifyTo,
        reply_to: data.email,
        subject,
        text,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[application-notify] Resend error:", resendRes.status, errText);
      return json({ error: "E-mail kon niet worden verzonden." }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("[application-notify] Unexpected error:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function renderEmail(d: {
  company_name: string;
  full_name: string;
  email: string;
  phone: string;
  kvk_number: string;
  motivation: string;
  membership_tier: string;
  dateFmt: string;
}): string {
  const e = escapeHtml;
  const primary = "#248eb7";
  const accent = "#bd8d2b";
  const logoUrl = `${SITE_URL}/logo-alislah.png`;
  const motivationHtml = e(d.motivation).replace(/\n/g, "<br/>");

  const row = (label: string, value: string, isLast = false) => `
    <tr>
      <td style="padding:14px 18px;${isLast ? "" : "border-bottom:1px solid #e2e8f0;"}">
        <div style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px;">${label}</div>
        <div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;font-weight:600;">${value}</div>
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Nieuwe lidmaatschapsaanvraag</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Nieuwe lidmaatschapsaanvraag van ${e(d.company_name)}.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:8px 0 24px 0;">
              <img src="${e(logoUrl)}" width="100" height="100" alt="Businessclub Al Islah"
                style="display:block;border:0;outline:none;text-decoration:none;width:100px;height:100px;border-radius:12px;" />
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${primary};margin-top:12px;font-weight:700;letter-spacing:0.3px;">
                Businessclub Al Islah
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);padding:32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="display:inline-block;background-color:#fdf3df;color:${accent};font-family:Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">
                      Nieuwe aanvraag
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:16px 0 24px 0;">
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#0f172a;font-weight:700;">
                      Nieuwe lidmaatschapsaanvraag ontvangen
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                      ${row("Bedrijfsnaam", e(d.company_name))}
                      ${row("Naam", e(d.full_name))}
                      ${row("E-mail", `<a href="mailto:${e(d.email)}" style="color:${primary};text-decoration:none;font-weight:600;">${e(d.email)}</a>`)}
                      ${row("Telefoon", `<a href="tel:${e(d.phone)}" style="color:${primary};text-decoration:none;font-weight:600;">${e(d.phone)}</a>`)}
                      ${row("KVK", e(d.kvk_number))}
                      ${row("Lidmaatschap", e(d.membership_tier))}
                      ${row("Datum aanvraag", e(d.dateFmt), true)}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0 0 0;">
                    <div style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:8px;">Motivatie</div>
                    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;border-left:3px solid ${primary};padding:14px 18px;border-radius:6px;background-color:#f8fafc;">
                      ${motivationHtml}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:28px 0 4px 0;">
                    <a href="${ADMIN_URL}" style="display:inline-block;background-color:${primary};color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      Open adminportaal
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;">
              Businessclub Al Islah · automatische notificatie
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
