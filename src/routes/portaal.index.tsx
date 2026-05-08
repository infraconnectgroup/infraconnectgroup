import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Calendar, MapPin } from "lucide-react";

export const Route = createFileRoute("/portaal/")({
  component: PortalDashboard,
});

type EventRow = { id: string; title: string; description: string | null; event_date: string; location: string | null };
type Profile = { full_name: string | null; company: string | null };

function PortalDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: p } = await supabase.from("profiles").select("full_name,company").eq("id", user.id).maybeSingle();
      setProfile(p as Profile);
      const { data: e } = await supabase.from("events").select("*").gte("event_date", new Date().toISOString()).order("event_date", { ascending: true }).limit(3);
      setEvents((e as EventRow[]) ?? []);
    })();
  }, [user]);

  return (
    <PortalShell>
      <div className="rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-light)] p-8 text-primary-foreground shadow-[var(--shadow-soft)]">
        <p className="text-sm opacity-90">Assalaamu alaikum,</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Welkom {profile?.full_name ?? user?.email} 👋</h1>
        <p className="mt-2 text-sm opacity-90">{profile?.company ?? "Fijn dat je er bent."}</p>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Komende events</h2>
        </div>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">Geen geplande events.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)]">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {new Date(e.event_date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-foreground">{e.title}</h3>
                {e.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {e.location}</p>}
                {e.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  );
}
