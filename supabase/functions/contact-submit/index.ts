// Supabase Edge Function: contact-submit
// Deploy: supabase functions deploy contact-submit --no-verify-jwt
//
// Secrets (Dashboard → Edge Functions → Secrets, of supabase secrets set):
//   RESEND_API_KEY          — Resend API key
//   CONTACT_FROM_EMAIL      — geverifieerde afzender, bijv. "Businessclub Al Islah <contact@business.alislah.nl>"
//
// Standaard gaat de notificatie naar bcislah@gmail.com. Optioneel overschrijven:
//   CONTACT_NOTIFY_EMAIL    — ander ontvanger-adres
//   CONTACT_NOTIFY_NAME     — optioneel: dan `to` als "Naam <email>"
//
// Runtime (automatisch): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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
    .replace(/"/g, "&quot;");
}

const DEFAULT_NOTIFY_EMAIL = "bcislah@gmail.com";

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
    const CONTACT_FROM_EMAIL = Deno.env.get("CONTACT_FROM_EMAIL");
    if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL) {
      console.error("Missing RESEND_API_KEY or CONTACT_FROM_EMAIL");
      return json({ error: "E-mailservice is niet geconfigureerd op de server." }, 503);
    }

    const notifyEmail =
      Deno.env.get("CONTACT_NOTIFY_EMAIL")?.trim() || DEFAULT_NOTIFY_EMAIL;
    const notifyName = Deno.env.get("CONTACT_NOTIFY_NAME")?.trim();
    // Resend: `to` moet een string zijn (geen array). Zonder naam: alleen het adres.
    const notifyTo = notifyName ? `${notifyName} <${notifyEmail}>` : notifyEmail;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const subject = `Contactformulier website — ${name}`;
    const text = [`Naam: ${name}`, `E-mail: ${email}`, "", message].join("\n");
    const html = `<p><strong>Naam:</strong> ${escapeHtml(name)}</p><p><strong>E-mail:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p><hr/><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: notifyTo,
        reply_to: email,
        subject,
        text,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", resendRes.status, errText);
      return json({ error: "E-mail kon niet worden verzonden." }, 502);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: insertErr } = await admin.from("contact_messages").insert({ name, email, message });
    if (insertErr) {
      console.error("Insert error:", insertErr);
      return json({ error: "Bericht kon niet worden opgeslagen." }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
