import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase";

const inputSchema = z.object({
  eventIds: z.array(z.string().uuid()).max(200).optional().default([]),
});

type UserRoleRow = { role: string };
type EventRegistrationRow = {
  event_id: string;
  user_id: string;
  created_at: string | null;
};
type ProfileRow = {
  id: string;
  full_name: string | null;
  company: string | null;
  email: string | null;
};

export const getAdminEventRegistrations = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const authorization = request.headers.get("authorization");

    if (!authorization) {
      throw new Error("Niet geautoriseerd.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Niet geautoriseerd.");
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      throw new Error(roleError.message);
    }

    const isAdmin = ((roleRows as UserRoleRow[] | null) ?? []).some((row) => row.role === "admin");
    if (!isAdmin) {
      throw new Error("Geen toegang tot event-aanmeldingen.");
    }

    let registrationsQuery = supabase
      .from("event_registrations")
      .select("event_id,user_id,created_at")
      .order("created_at", { ascending: true, nullsFirst: false });

    if (data.eventIds.length > 0) {
      registrationsQuery = registrationsQuery.in("event_id", data.eventIds);
    }

    const { data: registrationRows, error: registrationsError } = await registrationsQuery;

    if (registrationsError) {
      console.error("[admin.events] event_registrations query failed", registrationsError);
      throw new Error(registrationsError.message);
    }

    const registrations = (registrationRows as EventRegistrationRow[] | null) ?? [];
    const userIds = [...new Set(registrations.map((row) => row.user_id).filter(Boolean))];

    let profilesById = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id,full_name,company,email")
        .in("id", userIds);

      if (profilesError) {
        console.error("[admin.events] profiles query failed", profilesError);
        throw new Error(profilesError.message);
      }

      profilesById = new Map(
        ((profileRows as ProfileRow[] | null) ?? []).map((profile) => [profile.id, profile]),
      );
    }

    const grouped = registrations.reduce<Record<string, Array<{
      event_id: string;
      user_id: string;
      created_at: string | null;
      full_name: string | null;
      company: string | null;
      email: string | null;
    }>>>((acc, row) => {
      const profile = profilesById.get(row.user_id);
      const item = {
        event_id: row.event_id,
        user_id: row.user_id,
        created_at: row.created_at,
        full_name: profile?.full_name ?? null,
        company: profile?.company ?? null,
        email: profile?.email ?? null,
      };

      if (!acc[row.event_id]) acc[row.event_id] = [];
      acc[row.event_id].push(item);
      return acc;
    }, {});

    console.log("[admin.events] loaded registrations", {
      eventCount: Object.keys(grouped).length,
      registrationCount: registrations.length,
    });

    return { registrationsByEvent: grouped };
  });