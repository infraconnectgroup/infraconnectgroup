// Supabase Edge Function: document-mail-send
// Verstuurt een document per mail naar de juiste ontvangers.
// Privé: alleen gekoppeld lid. Algemeen: alle leden (profiles).
// Rechten worden server-side opnieuw gevalideerd via user_roles (admin).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = "https://businessclub-alislah.nl";


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function renderEmail(opts: {
  title: string;
  description: string;
  message: string;
  fileName: string;
}) {
  const primary = "#248eb7";
  const accent = "#bd8d2b";
  const logoUrl = `${SITE_URL}/logo-alislah.png`;
  const msgHtml = opts.message
    ? `<div style="background:#f7edd7;border-left:4px solid ${accent};padding:14px 18px;border-radius:8px;margin:18px 0;white-space:pre-wrap;line-height:1.6;color:#333;">${escapeHtml(
        opts.message,
      )}</div>`
    : "";
  const descHtml = opts.description
    ? `<p style="line-height:1.7;color:#444;">${escapeHtml(opts.description)}</p>`
    : "";
  return `<!DOCTYPE html><html lang="nl"><body style="margin:0;padding:0;background:#f3f4f6;">
<table width="100%" style="background:#f3f4f6;padding:32px 16px;"><tr><td align="center">
<table width="620" style="max-width:620px;width:100%;">
<tr><td align="center" style="padding-bottom:28px;">
<img src="${logoUrl}" width="90" alt="Al Islah" />
<div style="font-size:18px;font-weight:700;color:${primary};font-family:Georgia;padding-top:14px;">Businessclub Al Islah</div>
</td></tr>
<tr><td style="background:white;border-radius:24px;padding:42px 36px;font-family:Arial,sans-serif;">
<div align="center" style="margin-bottom:20px;">
<span style="background:#e6f3f8;color:${primary};padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;">Nieuw document</span>
</div>
<h1 style="font-size:26px;text-align:center;margin:0 0 24px;color:#111;">${escapeHtml(opts.title)}</h1>
${descHtml}
${msgHtml}
<p style="font-size:13px;color:#64748b;margin-top:20px;">Bijlage: <strong>${escapeHtml(opts.fileName)}</strong></p>
<div style="text-align:center;padding-top:24px;">
<a href="${PORTAL_URL}" style="display:inline-block;background:${accent};color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:600;">Bekijk in portaal</a>
</div>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const user = userData.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Server-side admin check
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin",
    );
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    console.log("[document-mail-send] body", body);
    const documentId: string = body.document_id;
    const subject: string = String(body.subject ?? "").slice(0, 200);
    const message: string = String(body.message ?? "").slice(0, 5000);
    console.log("[document-mail-send] documentId", documentId);
    if (!documentId || !subject)
      return json({ error: "Missing fields" }, 400);

    // Fetch document by id only
    console.log("[document-mail-send] document query", { table: "documents", id: documentId });
    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select(`
        id,
        title,
        description,
        storage_path,
        file_name,
        is_public,
        member_id
      `)
      .eq("id", documentId)
      .maybeSingle();

    if (docErr) {
      console.error("[document-mail-send] document error", docErr);
      return json({ error: "Document lookup failed: " + docErr.message }, 500);
    }
    if (!doc) {
      console.error("[document-mail-send] document not found", documentId);
      return json({ error: "Document not found", documentId }, 404);
    }
    console.log("[document-mail-send] document result", {
      id: doc.id,
      title: doc.title,
      storage_path: doc.storage_path,
    });

    if (!doc.storage_path) {
      console.error("[document-mail-send] empty storage_path", doc.id);
      return json({ error: "Document has no storage_path" }, 400);
    }

    // Determine recipients server-side
    const recipients: string[] = [];
    if (doc.is_public) {
      // All members: list all auth users that have a profile
      const { data: profiles } = await admin.from("profiles").select("id");
      const profileIds = new Set(
        (profiles ?? []).map((p: { id: string }) => p.id),
      );
      let page = 1;
      while (true) {
        const { data: list, error: lErr } = await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (lErr) break;
        for (const u of list.users) {
          if (u.email && profileIds.has(u.id)) recipients.push(u.email);
        }
        if (!list.users.length || list.users.length < 1000) break;
        page++;
      }
    } else {
      if (!doc.member_id)
        return json({ error: "Private document has no member" }, 400);
      const { data: u } = await admin.auth.admin.getUserById(doc.member_id);
      if (u?.user?.email) recipients.push(u.user.email);
    }

    // Dedup
    const uniqueRecipients = Array.from(
      new Set(recipients.map((e) => e.toLowerCase())),
    );
    if (uniqueRecipients.length === 0)
      return json({ ok: true, sent: 0, note: "no recipients" });

    // Download attachment from storage
    const { data: fileBlob, error: dlErr } = await admin.storage
      .from("documents")
      .download(doc.storage_path);
    if (dlErr || !fileBlob)
      return json({ error: "Download failed: " + (dlErr?.message ?? "") }, 500);

    const buf = new Uint8Array(await fileBlob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const fileB64 = btoa(binary);

    const html = renderEmail({
      title: doc.title,
      description: doc.description ?? "",
      message,
      fileName: doc.file_name,
    });

    // Batch send (one email per recipient for privacy)
    let sent = 0;
    let failed = 0;
    const BATCH = 4;
    for (let i = 0; i < uniqueRecipients.length; i += BATCH) {
      const slice = uniqueRecipients.slice(i, i + BATCH);
      console.log("[document-mail-send] batch start", {
        batchNumber: Math.floor(i / BATCH) + 1,
        batchSize: slice.length,
      });

      const results = await Promise.allSettled(
        slice.map((to) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Businessclub Al Islah <info@businessclub-alislah.nl>",
              to: [to],
              subject,
              html,
              attachments: [
                { filename: doc.file_name, content: fileB64 },
              ],
            }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
          }),
        ),
      );
      for (const r of results) {
        if (r.status === "fulfilled") sent++;
        else {
          failed++;
          console.error("[document-mail-send] send failed:", r.reason);
        }
      }

      if (i + BATCH < uniqueRecipients.length) {
        await sleep(1000);
      }
    }

    console.log("[document-mail-send] batch end", {
      totalSent: sent,
      totalFailed: failed,
    });

    return json({ ok: true, sent, failed, total: uniqueRecipients.length });
  } catch (e) {
    console.error("[document-mail-send] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
