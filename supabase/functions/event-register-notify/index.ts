// Supabase Edge Function: event-register-notify
// Stuurt een bevestigingsmail naar de ingelogde gebruiker NA succesvolle eventregistratie.
//
// Wordt asynchroon (fire-and-forget) aangeroepen vanuit de client direct na
// een geslaagde insert in event_registrations. Bij mailfout wordt de registratie
// NIET teruggedraaid; we returnen alleen een foutstatus.
//
// Body: { event_id: string }
// Auth: JWT van de ingelogde gebruiker (verify_jwt = true).
//
// Secrets:
//   RESEND_API_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
//   CONTACT_FROM_EMAIL (optioneel)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const DEFAULT_FROM = "Businessclub Al Islah <info@businessclub-alislah.nl>";
const SITE_URL = "https://businessclub-alislah.nl";
const AGENDA_URL = `${SITE_URL}/portaal/agenda`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function icsEscape(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fmtIcsUtc(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function buildIcs(opts: {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}): string {
  const now = new Date();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Businessclub Al Islah//Events//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${fmtIcsUtc(now)}`,
    `DTSTART:${fmtIcsUtc(opts.start)}`,
    `DTEND:${fmtIcsUtc(opts.end)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    console.log("[event-register-notify] started");
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      console.warn("[event-register-notify] no bearer token");
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[event-register-notify] Missing RESEND_API_KEY");
      return json({ error: "E-mailservice is niet geconfigureerd." }, 503);
    }

    const body = await req.json().catch(() => ({}));
    console.log("[event-register-notify] body", body);
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    if (!eventId) return json({ error: "event_id ontbreekt" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) {
      console.warn("[event-register-notify] auth failed", userErr);
      return json({ error: "Unauthorized" }, 401);
    }
    const user = userData.user;
    console.log("[event-register-notify] user", user.id, user.email);
    const recipient = user.email;
    if (!recipient) return json({ error: "Geen e-mailadres" }, 400);

    const { data: reg } = await admin
      .from("event_registrations")
      .select("event_id,user_id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!reg) {
      console.warn("[event-register-notify] registration not found", eventId, user.id);
      return json({ error: "Geen registratie gevonden" }, 404);
    }
    console.log("[event-register-notify] registration found");

    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("id,title,description,event_date,end_time,location")
      .eq("id", eventId)
      .maybeSingle();
    if (evErr || !ev) {
      console.warn("[event-register-notify] event not found", evErr);
      return json({ error: "Event niet gevonden" }, 404);
    }
    console.log("[event-register-notify] event found", ev.id, ev.title);

    const start = new Date(ev.event_date);
    let end: Date;
    if (ev.end_time) {
      const [h, m] = String(ev.end_time).split(":").map(Number);
      end = new Date(start);
      end.setHours(h || 0, m || 0, 0, 0);
      if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    const dateFmt = start.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Amsterdam",
    });
    const startTimeFmt = start.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    });
    const endTimeFmt = ev.end_time
      ? end.toLocaleTimeString("nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Amsterdam",
        })
      : "";

    const location = (ev.location ?? "").trim();
    const mapsUrl = location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
      : "";

    const ics = buildIcs({
      uid: `${ev.id}-${user.id}@businessclub-alislah.nl`,
      title: ev.title,
      description: ev.description ?? "",
      location,
      start,
      end,
    });
    const icsBase64 = btoa(unescape(encodeURIComponent(ics)));

    const subject = `Bevestiging aanmelding – ${ev.title}`;
    const text = [
      `Bedankt voor je aanmelding voor: ${ev.title}`,
      "",
      `Datum: ${dateFmt}`,
      `Tijd: ${startTimeFmt}${endTimeFmt ? ` – ${endTimeFmt}` : ""}`,
      location ? `Locatie: ${location}` : "",
      ev.description ? `\n${ev.description}` : "",
      "",
      mapsUrl ? `Open locatie: ${mapsUrl}` : "",
      `Bekijk mijn aanmeldingen: ${AGENDA_URL}`,
    ]
      .filter(Boolean)
      .join("\n");

    const html = renderEmail({
      title: ev.title,
      description: ev.description ?? "",
      dateFmt,
      startTimeFmt,
      endTimeFmt,
      location,
      mapsUrl,
    });

    console.log("[event-register-notify] sending email to", recipient);
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("CONTACT_FROM_EMAIL")?.trim() || DEFAULT_FROM,
        to: recipient,
        subject,
        text,
        html,
        attachments: [
          {
            filename: "event.ics",
            content: icsBase64,
            content_type: "text/calendar; charset=utf-8; method=PUBLISH",
          },
        ],
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[event-register-notify] Resend error:", resendRes.status, errText);
      return json({ error: "E-mail kon niet worden verzonden." }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("[event-register-notify] Unexpected error:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function renderEmail(d: {
  title: string;
  description: string;
  dateFmt: string;
  startTimeFmt: string;
  endTimeFmt: string;
  location: string;
  mapsUrl: string;
}): string {
  const e = escapeHtml;
  const primary = "#248eb7";
  const accent = "#bd8d2b";
  const logoUrl = `${SITE_URL}/logo-alislah.png`;
  const descHtml = e(d.description).replace(/\n/g, "<br/>");
  const timeStr = d.endTimeFmt ? `${d.startTimeFmt} – ${d.endTimeFmt}` : d.startTimeFmt;

  const row = (label: string, value: string, isLast = false) => `
    <tr>
      <td style="padding:14px 18px;${isLast ? "" : "border-bottom:1px solid #e2e8f0;"}">
        <div style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px;">${label}</div>
        <div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;font-weight:600;">${value}</div>
      </td>
    </tr>`;

  const locationBtn = d.mapsUrl
    ? `<a href="${e(d.mapsUrl)}" style="display:inline-block;background-color:${primary};color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;margin:4px;">Open locatie</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Bevestiging aanmelding</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f8;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:8px 0 24px 0;">
          <img src="${e(logoUrl)}" width="100" height="100" alt="Businessclub Al Islah"
            style="display:block;border:0;outline:none;text-decoration:none;width:100px;height:100px;border-radius:12px;" />
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${primary};margin-top:12px;font-weight:700;letter-spacing:0.3px;">
            Businessclub Al Islah
          </div>
        </td></tr>
        <tr><td style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);padding:32px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="padding-bottom:8px;">
              <span style="display:inline-block;background-color:#fdf3df;color:${accent};font-family:Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">
                Aanmelding bevestigd
              </span>
            </td></tr>
            <tr><td align="center" style="padding:16px 0 24px 0;">
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#0f172a;font-weight:700;">
                ${e(d.title)}
              </h1>
            </td></tr>
            <tr><td style="padding:0 0 16px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                ${row("Datum", e(d.dateFmt))}
                ${row("Tijd", e(timeStr))}
                ${d.location ? row("Locatie", e(d.location), true) : ""}
              </table>
            </td></tr>
            ${
              d.description
                ? `<tr><td style="padding:8px 0 0 0;">
              <div style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:8px;">Beschrijving</div>
              <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;border-left:3px solid ${primary};padding:14px 18px;border-radius:6px;background-color:#f8fafc;">
                ${descHtml}
              </div>
            </td></tr>`
                : ""
            }
            <tr><td align="center" style="padding:28px 0 4px 0;">
              ${locationBtn}
              <a href="cid:event.ics" style="display:inline-block;background-color:#ffffff;color:${primary};border:1px solid ${primary};font-family:Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;margin:4px;">Toevoegen aan agenda</a>
              <a href="${e(AGENDA_URL)}" style="display:inline-block;background-color:${accent};color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;margin:4px;">Bekijk mijn aanmeldingen</a>
            </td></tr>
            <tr><td align="center" style="padding:12px 0 0 0;">
              <div style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;">
                De agenda-uitnodiging (.ics) is bijgevoegd bij deze e-mail.
              </div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 8px;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;">
          Businessclub Al Islah · automatische bevestiging
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
