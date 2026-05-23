// Supabase Edge Function: event-register-notify
// Verstuurt bevestigingsmail na succesvolle eventregistratie.
// Fire-and-forget: mailfouten blokkeren registratie NOOIT.

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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const DEFAULT_FROM =
  "Businessclub Al Islah <info@businessclub-alislah.nl>";

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
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(
      d.getUTCSeconds(),
    )}Z`
  );
}

function buildIcs(opts: {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}) {
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    console.log("[event-register-notify] started");

    const authHeader =
      req.headers.get("Authorization") ?? "";

    const body = await req.json().catch(() => ({}));

    console.log(
      "[event-register-notify] body",
      body,
    );

    const eventId =
      typeof body.event_id === "string"
        ? body.event_id
        : "";

    if (!eventId) {
      return json(
        { error: "event_id ontbreekt" },
        400,
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      )!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: userData,
      error: userErr,
    } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );

    if (userErr || !userData.user) {
      console.error(
        "[event-register-notify] user error",
        userErr,
      );

      return json(
        { error: "Unauthorized" },
        401,
      );
    }

    const user = userData.user;

    console.log(
      "[event-register-notify] user",
      user.id,
      user.email,
    );

    const recipient = user.email;

    if (!recipient) {
      return json(
        { error: "No email" },
        400,
      );
    }

    const {
      data: ev,
      error: evErr,
    } = await admin
      .from("events")
      .select(
        "id,title,description,event_date,end_time,location",
      )
      .eq("id", eventId)
      .maybeSingle();

    if (evErr || !ev) {
      console.error(
        "[event-register-notify] event error",
        evErr,
      );

      return json(
        { error: "Event niet gevonden" },
        404,
      );
    }

    console.log(
      "[event-register-notify] event found",
      ev.id,
    );

    const start = new Date(
      ev.event_date,
    );

    let end: Date;

    if (ev.end_time) {
      const [h, m] =
        String(ev.end_time)
          .split(":")
          .map(Number);

      end = new Date(start);

      end.setHours(
        h || 0,
        m || 0,
        0,
        0,
      );
    } else {
      end = new Date(
        start.getTime() +
          60 * 60 * 1000,
      );
    }

    const location =
      ev.location ?? "";

    const mapsUrl = location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          location,
        )}`
      : "";

    const ics = buildIcs({
      uid:
        `${ev.id}-${user.id}` +
        "@businessclub-alislah.nl",
      title: ev.title,
      description:
        ev.description ?? "",
      location,
      start,
      end,
    });

    const encoder =
      new TextEncoder();

    const bytes =
      encoder.encode(ics);

    let binary = "";

    for (const b of bytes) {
      binary +=
        String.fromCharCode(b);
    }

    const icsBase64 =
      btoa(binary);

    const html =
      renderEmail({
        title: ev.title,
        description:
          ev.description ?? "",
        dateFmt:
          start.toLocaleDateString(
            "nl-NL",
          ),
        startTimeFmt:
          start.toLocaleTimeString(
            "nl-NL",
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          ),
        endTimeFmt:
          ev.end_time ?? "",
        location,
        mapsUrl,
      });

    console.log(
      "[event-register-notify] sending email",
      recipient,
    );

    const resendRes =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${Deno.env.get(
                "RESEND_API_KEY",
              )}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            {
              from:
                Deno.env.get(
                  "CONTACT_FROM_EMAIL",
                ) ??
                DEFAULT_FROM,

              to: [recipient],

              subject:
                `Bevestiging aanmelding – ${ev.title}`,

              html,

              attachments:
                [
                  {
                    filename:
                      "event.ics",

                    content:
                      icsBase64,
                  },
                ],
            },
          ),
        },
      );

    console.log(
      "[event-register-notify] resend response",
      resendRes.status,
    );

    if (!resendRes.ok) {
      const txt =
        await resendRes.text();

      console.error(
        "[event-register-notify] resend",
        resendRes.status,
        txt,
      );

      return json(
        {
          error:
            "Mail fout",
        },
        502,
      );
    }

    return json({
      ok: true,
    });
  } catch (e) {
    console.error(
      "[event-register-notify]",
      e,
    );

    return json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Unexpected",
      },
      500,
    );
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
}) {
  return `
<html>
<body>
<h2>Aanmelding bevestigd</h2>

<p>
Je bent aangemeld voor:
<strong>${escapeHtml(
    d.title,
  )}</strong>
</p>

<p>
Datum:
${escapeHtml(d.dateFmt)}
</p>

<p>
Tijd:
${escapeHtml(
    d.startTimeFmt,
  )}
</p>

${
    d.location
      ? `<p>Locatie:
${escapeHtml(
  d.location,
)}</p>`
      : ""
  }

${
    d.mapsUrl
      ? `<p>
<a href="${escapeHtml(
          d.mapsUrl,
        )}">
Open locatie
</a>
</p>`
      : ""
  }

<p>
Agenda uitnodiging
(.ics) is bijgevoegd.
</p>

<p>
<a href="${AGENDA_URL}">
Bekijk mijn aanmeldingen
</a>
</p>

</body>
</html>
`;
}
