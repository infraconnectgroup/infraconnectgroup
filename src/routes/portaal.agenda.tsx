import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Calendar, MapPin, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/portaal/agenda")({
  component: AgendaPage,
});

type EventRow = { id: string; title: string; description: string | null; event_date: string; end_time: string | null; location: string | null };

function formatWhen(eventDateIso: string, endTime: string | null): string {
  const base = new Date(eventDateIso).toLocaleString("nl-NL", { dateStyle: "long", timeStyle: "short" })
  .replace(" om ", " • ");
  if (!endTime) return base;
  const [h, m] = endTime.split(":");
  return `${base} – ${h}:${m}`;
}


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

  const notifiedRef = (typeof window !== "undefined")
    ? ((window as unknown as { __evNotified?: Set<string> }).__evNotified ??= new Set<string>())
    : new Set<string>();

  async function register(eventId: string) {
    if (!user) return;
    setBusyId(eventId);
    const { error } = await supabase.from("event_registrations").insert({ event_id: eventId, user_id: user.id });
    if (!error) {
      const key = `${user.id}:${eventId}`;
      if (!notifiedRef.has(key)) {
        notifiedRef.add(key);
        // Fire-and-forget: mailfout mag registratie niet beïnvloeden
        void (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            await fetch(`https://mzgobfulqqabznqflhjq.supabase.co/functions/v1/event-register-notify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ event_id: eventId }),
            });
          } catch (e) {
            console.warn("[agenda] notify failed", e);
          }
        })();
      }
    }
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
        <div className="mt-6 space-y-3">
          {(() => {
            const now = new Date();
            const upcoming = events.filter((e) => new Date(e.event_date) >= now);
            const past = events.filter((e) => new Date(e.event_date) < now).sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
            return (
              <>
                {upcoming.map((e) => {
                  const isReg = registered.has(e.id);
                  return (
                    <div key={e.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                          <Calendar size={12} />
                          {formatWhen(e.event_date, e.end_time)}

                        </div>
                        <h3 className="mt-1 font-display text-lg font-bold">{e.title}</h3>
                        {e.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {e.location}</p>}
                        {e.description && <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>}
                      </div>
                      <div>
                        {isReg ? (
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
                {past.length > 0 && (
                  <>
                    <h2 className="mb-3 mt-8 font-display text-xl font-bold">Geweest</h2>
                    {past.map((e) => (
                      <div key={e.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                            <Calendar size={12} />
                            {formatWhen(e.event_date, e.end_time)}
                          </div>
                          <h3 className="mt-1 font-display text-lg font-bold">{e.title}</h3>
                          {e.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {e.location}</p>}
                          {e.description && <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>}
                        </div>
                        <div>
                          <span className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">Geweest</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
    </PortalShell>
  );
}
