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

const SITE_URL =
  "https://businessclub-alislah.nl";

const AGENDA_URL =
  `${SITE_URL}/portaal/agenda`;

function fmtUtc(
  d: Date,
) {
  return d
    .toISOString()
    .replace(
      /[-:]/g,
      "",
    )
    .replace(
      /\.\d+/,
      "",
    );
}

function buildIcs(
  title: string,
  description: string,
  location: string,
  start: Date,
  end?: Date,
) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Businessclub Al Islah//Events//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",

    `UID:${crypto.randomUUID()}`,

    `DTSTART:${fmtUtc(
      start,
    )}`,

    end
      ? `DTEND:${fmtUtc(
          end,
        )}`
      : "",

    `SUMMARY:${title}`,

    `DESCRIPTION:${description}`,

    `LOCATION:${location}`,

    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(
      Boolean,
    )
    .join(
      "\r\n",
    );
}

Deno.serve(
  async (req) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    try {
      console.log(
        "[event-register-notify] started",
      );

      const authHeader =
        req.headers.get(
          "Authorization",
        ) ?? "";

      const body =
        await req.json();

      const admin =
        createClient(
          Deno.env.get(
            "SUPABASE_URL",
          )!,
          Deno.env.get(
            "SUPABASE_SERVICE_ROLE_KEY",
          )!,
        );

      const {
        data:
          userData,
      } =
        await admin.auth.getUser(
          authHeader.replace(
            "Bearer ",
            "",
          ),
        );

      const user =
        userData.user;

      if (
        !user?.email
      ) {
        return json(
          {
            ok: true,
          },
        );
      }

      const {
        data: ev,
      } =
        await admin
          .from(
            "events",
          )
          .select(
            `
title,
description,
event_date,
end_time,
location
`,
          )
          .eq(
            "id",
            body.event_id,
          )
          .single();

      const start =
        new Date(
          ev.event_date,
        );

      let end:
        | Date
        | undefined;

      if (
        ev.end_time
      ) {
        const [
          h,
          m,
        ] =
          String(
            ev.end_time,
          )
            .split(
              ":",
            )
            .map(
              Number,
            );

        end =
          new Date(
            start,
          );

        end.setHours(
          h || 0,
          m || 0,
          0,
          0,
        );
      }

      const mapsUrl =
        ev.location
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              ev.location,
            )}`
          : "";

      const icsTitle =
        `Businessclub Al Islah – ${ev.title}`;

      const ics =
        buildIcs(
          icsTitle,
          ev.description ??
            "",
          ev.location ??
            "",
          start,
          end,
        );

      const encoder =
        new TextEncoder();

      const bytes =
        encoder.encode(
          ics,
        );

      let binary =
        "";

      for (
        const b of bytes
      ) {
        binary +=
          String.fromCharCode(
            b,
          );
      }

      const ics64 =
        btoa(
          binary,
        );

      const html =
        renderEmail(
          {
            title:
              ev.title,

            description:
              ev.description ??
              "",

            dateFmt:
              start.toLocaleDateString(
                "nl-NL",
              ),

            startTimeFmt:
              start.toLocaleTimeString(
                "nl-NL",
                {
                  hour:
                    "2-digit",
                  minute:
                    "2-digit",
                },
              ),

            endTimeFmt:
              ev.end_time ??
              "",

            location:
              ev.location ??
              "",

            mapsUrl,
          },
        );

      const res =
        await fetch(
          "https://api.resend.com/emails",
          {
            method:
              "POST",

            headers:
              {
                Authorization:
                  `Bearer ${Deno.env.get(
                    "RESEND_API_KEY",
                  )}`,

                "Content-Type":
                  "application/json",
              },

            body:
              JSON.stringify(
                {
                  from:
                    "Businessclub Al Islah <info@businessclub-alislah.nl>",

                  to: [
                    user.email,
                  ],

                  subject:
                    `Bevestiging aanmelding – ${ev.title}`,

                  html,

                  attachments:
                    [
                      {
                        filename:
                          "event.ics",

                        content:
                          ics64,
                      },
                    ],
                },
              ),
          },
        );

      console.log(
        "[event-register-notify] resend response",
        res.status,
      );

      return json(
        {
          ok: true,
        },
      );
    } catch (e) {
      console.error(
        e,
      );

      return json(
        {
          ok: false,
        },
        500,
      );
    }
  },
);

function renderEmail(
  d: {
    title: string;
    description: string;
    dateFmt: string;
    startTimeFmt: string;
    endTimeFmt: string;
    location: string;
    mapsUrl: string;
  },
) {
  const logoUrl =
    `${SITE_URL}/logo-alislah.png`;

  const primary =
    "#248eb7";

  const accent =
    "#bd8d2b";

  const time =
    d.endTimeFmt
      ? `${d.startTimeFmt} – ${d.endTimeFmt}`
      : d.startTimeFmt;

  return `
<!DOCTYPE html>
<html lang="nl">

<body
style="
margin:0;
padding:0;
background:#f4f6f8;
">

<table
width="100%"
style="
background:#f4f6f8;
">

<tr>
<td
align="center"
style="
padding:32px 16px;
">

<table
width="600"
style="
max-width:600px;
width:100%;
">

<tr>
<td
align="center"
style="
padding:8px 0 24px;
">

<img
src="${logoUrl}"
width="100"
height="100"
style="
border-radius:12px;
"/>

<div
style="
font-family:Georgia;
font-size:18px;
color:${primary};
margin-top:12px;
font-weight:700;
">

Businessclub Al Islah

</div>

</td>
</tr>

<tr>
<td
style="
background:white;
border-radius:16px;
padding:40px 32px;
">

<div
style="
text-align:center;
">

<span
style="
background:#fdf3df;
color:${accent};
padding:6px 14px;
border-radius:999px;
">

Aanmelding bevestigd

</span>

</div>

<h1
style="
text-align:center;
">

${d.title}

</h1>

<p>
<strong>
Datum:
</strong>

${d.dateFmt}
</p>

<p>
<strong>
Tijd:
</strong>

${time}
</p>

${
  d.location
    ? `
<p>
<strong>
Locatie:
</strong>

${d.location}
</p>
`
    : ""
}

${
  d.description
    ? `
<p>

${d.description}

</p>
`
    : ""
}

${
  d.mapsUrl
    ? `
<p>

<a
href="${d.mapsUrl}"
>

Open locatie

</a>

</p>
`
    : ""
}

<p>

<a
href="${AGENDA_URL}"
>

Bekijk mijn aanmeldingen

</a>

</p>

<p
style="
font-size:13px;
color:#64748b;
">

Agenda-uitnodiging
(.ics)
bijgevoegd

</p>

</td>
</tr>

</table>

</td>
</tr>

</table>

</body>

</html>
`;
}
