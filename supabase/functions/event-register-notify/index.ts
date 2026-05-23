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
        title
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

    console.log(
      "[event-register-notify] sending email",
    );

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
                  recipient,
                ],

                subject:
                  `TEST event mail - ${ev.title}`,

                html:
                  `
                  <h1>Test</h1>

                  <p>
                  Event:
                  ${ev.title}
                  </p>
                  `,
              },
            ),
        },
      );

    console.log(
      "[event-register-notify] resend response",
      res.status,
    );

    if (!res.ok) {
      const txt =
        await res.text();

      console.error(
        "[event-register-notify] resend",
        res.status,
        txt,
      );

      return json(
        {
          error:
            txt,
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
