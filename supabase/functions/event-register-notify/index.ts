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

const AGENDA_URL =
  "https://businessclub-alislah.nl/portaal/agenda";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      { headers: corsHeaders },
    );
  }

  try {
    const authHeader =
      req.headers.get(
        "Authorization",
      ) ?? "";

    const body =
      await req.json();

    const eventId =
      body.event_id;

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
      data: userData,
    } =
      await admin.auth.getUser(
        authHeader.replace(
          "Bearer ",
          "",
        ),
      );

    const user =
      userData.user;

    if (!user?.email) {
      return json({
        ok: true,
      });
    }

    const {
      data: ev,
    } = await admin
      .from("events")
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
        eventId,
      )
      .single();

    const mapsUrl =
      ev.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            ev.location,
          )}`
        : "";

    const html = `
<h2>
Aanmelding bevestigd
</h2>

<p>
Je bent aangemeld voor:
<strong>
${ev.title}
</strong>
</p>

<p>
Datum:
${ev.event_date}
</p>

${
      ev.end_time
        ? `
<p>
Eindtijd:
${ev.end_time}
</p>
`
        : ""
    }

${
      ev.location
        ? `
<p>
Locatie:
${ev.location}
</p>
`
        : ""
    }

${
      ev.description
        ? `
<p>
${ev.description}
</p>
`
        : ""
    }

${
      mapsUrl
        ? `
<p>
<a href="${mapsUrl}">
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

<p>
Agenda bestand volgt
in volgende stap
</p>
`;

    const res =
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
                  "Businessclub Al Islah <info@businessclub-alislah.nl>",

                to: [
                  user.email,
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
      res.status,
    );

    return json({
      ok: true,
    });
  } catch (e) {
    console.error(e);

    return json(
      { ok: false },
      500,
    );
  }
});
