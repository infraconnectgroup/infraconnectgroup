// supabase/functions/event-register-notify/index.ts

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      405,
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
      await req
        .json()
        .catch(() => ({}));

    console.log(
      "[event-register-notify] body",
      body,
    );

    const eventId =
      typeof body.event_id ===
      "string"
        ? body.event_id
        : "";

    if (!eventId) {
      return json(
        {
          error:
            "event_id ontbreekt",
        },
        400,
      );
    }

    const admin =
      createClient(
        Deno.env.get(
          "SUPABASE_URL",
        )!,
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        )!,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        },
      );

    const {
      data: userData,
      error: userErr,
    } =
      await admin.auth.getUser(
        authHeader.replace(
          "Bearer ",
          "",
        ),
      );

    if (
      userErr ||
      !userData.user
    ) {
      console.error(
        "[event-register-notify] auth error",
        userErr,
      );

      return json(
        {
          error:
            "Unauthorized",
        },
        401,
      );
    }

    const user =
      userData.user;

    console.log(
      "[event-register-notify] user",
      user.id,
      user.email,
    );

    const recipient =
      user.email;

    console.log(
      "[event-register-notify] recipient",
      recipient,
    );

    if (!recipient) {
      return json(
        {
          error:
            "Geen email",
        },
        400,
      );
    }

    const {
      data: ev,
      error: evErr,
    } = await admin
      .from("events")
      .select(
        `
        id,
        title,
        description,
        event_date,
        end_time,
        location
      `,
      )
      .eq(
        "id",
        eventId,
      )
      .maybeSingle();

    if (
      evErr ||
      !ev
    ) {
      console.error(
        "[event-register-notify] event error",
        evErr,
      );

      return json(
        {
          error:
            "Event niet gevonden",
        },
        404,
      );
    }

    console.log(
      "[event-register-notify] event found",
      ev.id,
      ev.title,
    );

    const location =
      ev.location ??
      "";

    const mapsUrl =
      location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            location,
          )}`
        : "";

    const html =
      renderEmail({
        title:
          ev.title,
        description:
          ev.description ??
          "",
        date:
          ev.event_date,
        start:
          ev.event_date,
        end:
          ev.end_time ??
          "",
        location,
        mapsUrl,
      });

    console.log(
      "[event-register-notify] sending email",
    );

    const resendRes =
      await fetch(
        "https://api.resend.com/emails",
        {
          method:
            "POST",

          headers: {
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
                  Deno.env.get(
                    "CONTACT_FROM_EMAIL",
                  ) ??
                  DEFAULT_FROM,

                to: [
                  recipient,
                ],

                subject:
                  `Bevestiging aanmelding – ${ev.title}`,

                html,
              },
            ),
        },
      );

    console.log(
      "[event-register-notify] resend response",
      resendRes.status,
    );

    if (
      !resendRes.ok
    ) {
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
          e instanceof
          Error
            ? e.message
            : "Unexpected",
      },
      500,
    );
  }
});

function renderEmail(
  d: {
    title: string;
    description: string;
    date: string;
    start: string;
    end: string;
    location: string;
    mapsUrl: string;
  },
) {
  return `
<html>
<body>

<h2>
Aanmelding bevestigd
</h2>

<p>
Je bent aangemeld voor:
<b>${escapeHtml(
    d.title,
  )}</b>
</p>

<p>
Datum:
${escapeHtml(
    d.date,
  )}
</p>

${
    d.location
      ? `
<p>
Locatie:
${escapeHtml(
  d.location,
)}
</p>
`
      : ""
  }

${
    d.mapsUrl
      ? `
<p>
<a href="${escapeHtml(
          d.mapsUrl,
        )}">
Open locatie
</a>
</p>
`
      : ""
  }

<p>
<a href="${AGENDA_URL}">
Bekijk mijn aanmeldingen
</a>
</p>

</body>
</html>
`;
}
