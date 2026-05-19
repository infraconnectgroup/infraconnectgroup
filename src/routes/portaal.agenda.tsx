import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Calendar, MapPin, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/portaal/agenda")({
  component: AgendaPage,
});

type EventRow = { id: string; title: string; description: string | null; event_date: string; location: string | null };

function AgendaPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: e }, { data: r }] = await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: true }),
      user ? supabase.from("event_registrations").select("event_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    setEvents((e as EventRow[]) ?? []);
    setRegistered(new Set(((r as { event_id: string }[]) ?? []).map((x) => x.event_id)));
    setLoading(false);
  }
  useEffect(() => { if (user) void load(); }, [user]);

  async function register(eventId: string) {
    if (!user) return;
    setBusyId(eventId);
    await supabase.from("event_registrations").insert({ event_id: eventId, user_id: user.id });
    await load();
    setBusyId(null);
  }
  async function unregister(eventId: string) {
    if (!user) return;
    setBusyId(eventId);
    await supabase.from("event_registrations").delete().eq("event_id", eventId).eq("user_id", user.id);
    await load();
    setBusyId(null);
  }

  return (
    <PortalShell>
      <h1 className="font-display text-3xl font-bold">Agenda</h1>
      <p className="mt-1 text-sm text-muted-foreground">Bijeenkomsten en evenementen voor leden.</p>

      {loading ? (
        <div className="mt-6 flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : events.length === 0 ? (
        <div className="mt-6">
          <p className="rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">Geen events.</p>
        </div>
      ) : (
        <AgendaLists events={events} registered={registered} busyId={busyId} onRegister={register} onUnregister={unregister} />
      )}
    </PortalShell>
  );
}
