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

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">Geen events.</p>
        ) : events.map((e) => {
          const isReg = registered.has(e.id);
          const past = new Date(e.event_date) < new Date();
          return (
            <div key={e.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  <Calendar size={12} />
                  {new Date(e.event_date).toLocaleString("nl-NL", { dateStyle: "long", timeStyle: "short" })}
                </div>
                <h3 className="mt-1 font-display text-lg font-bold">{e.title}</h3>
                {e.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {e.location}</p>}
                {e.description && <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>}
              </div>
              <div>
                {past ? (
                  <span className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">Geweest</span>
                ) : isReg ? (
                  <button disabled={busyId === e.id} onClick={() => unregister(e.id)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-secondary">
                    <Check size={14} /> Aangemeld
                  </button>
                ) : (
                  <button disabled={busyId === e.id} onClick={() => register(e.id)} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-[var(--accent-light)] disabled:opacity-60">
                    {busyId === e.id ? "…" : "Aanmelden"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PortalShell>
  );
}
