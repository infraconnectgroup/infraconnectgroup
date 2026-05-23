import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL =
  "https://businessclub-alislah.nl";

const AGENDA_URL =
  `${SITE_URL}/portaal/agenda`;

function json(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

function pad(
  n: number,
) {
  return String(n)
    .padStart(
      2,
      "0",
    );
}

function fmtAmsterdam(
  d: Date,
) {
  return (
    `${d.getFullYear()}` +
    `${pad(
      d.getMonth() + 1,
    )}` +
    `${pad(
      d.getDate(),
    )}` +
    "T" +
    `${pad(
      d.getHours(),
    )}` +
    `${pad(
      d.getMinutes(),
    )}` +
    "00"
  );
}

function escapeIcs(
  value: string,
) {
  return value
    .replace(
      /\\/g,
      "\\\\",
    )
    .replace(
      /\n/g,
      "\\n",
    )
    .replace(
      /,/g,
      "\\,",
    )
    .replace(
      /;/g,
      "\\;",
    );
}

function buildIcs(
  opts: {
    uid: string;
    title: string;
    description: string;
    location: string;
    start: Date;
    end?: Date;
  },
) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Businessclub Al Islah//Events//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",

    "BEGIN:VTIMEZONE",
    "TZID:Europe/Amsterdam",
    "END:VTIMEZONE",

    "BEGIN:VEVENT",

    `UID:${opts.uid}`,

    `DTSTART;TZID=Europe/Amsterdam:${fmtAmsterdam(
      opts.start,
    )}`,

    opts.end
      ? `DTEND;TZID=Europe/Amsterdam:${fmtAmsterdam(
          opts.end,
        )}`
      : "",

    `SUMMARY:${escapeIcs(
      opts.title,
    )}`,

    `DESCRIPTION:${escapeIcs(
      opts.description,
    )}`,

    `X-ALT-DESC;FMTTYPE=text/plain:${escapeIcs(
      opts.description,
    )}`,

    `LOCATION:${escapeIcs(
      opts.location,
    )}`,

    "ORGANIZER;CN=Businessclub Al Islah:mailto:info@businessclub-alislah.nl",

    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Event start over 15 minuten",
    "END:VALARM",

    "END:VEVENT",

    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
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
        return json({
          ok: true,
        });
      }

      const {
        data: ev,
      } =
        await admin
          .from(
            "events",
          )
          .select(`
title,
description,
event_date,
end_time,
location
`)
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

      const ics =
        buildIcs(
          {
            uid:
              `${body.event_id}-${user.id}@businessclub-alislah.nl`,

            title:
              `Businessclub Al Islah – ${ev.title}`,

            description:
              ev.description ??
              "",

            location:
              ev.location ??
              "",

            start,

            end,
          },
        );

      const bytes =
        new TextEncoder()
          .encode(
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
        renderEmail({
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
        });

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

      return json({
        ok: true,
      });

    } catch (
      e
    ) {
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
  d: any,
) {
  const primary =
    "#248eb7";

  const accent =
    "#bd8d2b";

  const logoUrl =
    `${SITE_URL}/logo-alislah.png`;

  const cleanEnd =
    d.endTimeFmt.replace(
      /:\d{2}$/,
      "",
    );

  const time =
    cleanEnd
      ? `${d.startTimeFmt} – ${cleanEnd}`
      : d.startTimeFmt;

  return `
<!DOCTYPE html>

<html lang="nl">

<body style="
margin:0;
padding:0;
background:#f3f4f6;
">

<table
width="100%"
style="
background:#f3f4f6;
padding:32px 16px;
">

<tr>

<td align="center">

<table
width="620"
style="
max-width:620px;
width:100%;
">

<tr>

<td
align="center"
style="
padding-bottom:28px;
">

<img
src="${logoUrl}"
width="90"
/>

<div style="
font-size:18px;
font-weight:700;
color:${primary};
font-family:Georgia;
padding-top:14px;
">

Businessclub Al Islah

</div>

</td>

</tr>

<tr>

<td style="
background:white;
border-radius:24px;
padding:42px 36px;
">

<div
align="center"
style="
margin-bottom:20px;
">

<span style="
background:#f7edd7;
color:${accent};
padding:10px 18px;
border-radius:999px;
">

Aanmelding bevestigd

</span>

</div>

<h1 style="
font-size:30px;
text-align:center;
margin-bottom:30px;
">

${d.title}

</h1>

<p><strong>Datum:</strong> ${d.dateFmt}</p>
<p><strong>Tijd:</strong> ${time}</p>

${
  d.location
    ? `<p><strong>Locatie:</strong> ${d.location}</p>`
    : ""
}

${
  d.description
    ? `<p style="line-height:1.7;">${d.description}</p>`
    : ""
}

<div style="
text-align:center;
padding-top:24px;
">

${
d.mapsUrl
?`
<a
href="${d.mapsUrl}"
style="
display:inline-block;
background:${primary};
color:white;
padding:14px 22px;
border-radius:12px;
text-decoration:none;
margin:4px;
">

Open locatie

</a>
`
:""
}

<a
href="${AGENDA_URL}"
style="
display:inline-block;
background:${accent};
color:white;
padding:14px 22px;
border-radius:12px;
text-decoration:none;
margin:4px;
">

Bekijk mijn aanmeldingen

</a>

</div>

<p style="
font-size:13px;
color:#64748b;
text-align:center;
padding-top:28px;
">

Agenda-uitnodiging (.ics) bijgevoegd

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
