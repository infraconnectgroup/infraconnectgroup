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
    `T` +
    `${pad(
      d.getHours(),
    )}` +
    `${pad(
      d.getMinutes(),
    )}` +
    "00"
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

    `SUMMARY:${opts.title}`,

    `DESCRIPTION:${opts.description}`,

    `LOCATION:${opts.location}`,

    "ORGANIZER;CN=Businessclub Al Islah:mailto:info@businessclub-alislah.nl",

    "BEGIN:VALARM",

    "TRIGGER:-PT15M",

    "ACTION:DISPLAY",

    "DESCRIPTION:Event start over 15 minuten",

    "END:VALARM",

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

      const icsTitle =
        `Businessclub Al Islah – ${ev.title}`;

      const icsDescription =
        `
Businessclub Al Islah

${ev.description ?? ""}

Bekijk aanmeldingen:
${AGENDA_URL}
`;

      const ics =
        buildIcs(
          {
            uid:
              `${body.event_id}-${user.id}@businessclub-alislah.nl`,

            title:
              icsTitle,

            description:
              icsDescription,

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

              "X-Entity-Ref-ID":
                `event-${body.event_id}-${user.id}`,
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
<html>

<body
style="
background:#f4f6f8;
padding:32px;
">

<div
style="
display:none;
max-height:0;
overflow:hidden;
opacity:0;
">

Bevestiging voor
${d.title}

</div>

<h2>
${d.title}
</h2>

<p>
Datum:
${d.dateFmt}
</p>

<p>
Tijd:
${time}
</p>

<p>
${d.location}
</p>

<p>
${d.description}
</p>

<a
href="${d.mapsUrl}"
>

Open locatie

</a>

<br/><br/>

<a
href="${AGENDA_URL}"
>

Bekijk mijn
aanmeldingen

</a>

</body>

</html>
`;
}
