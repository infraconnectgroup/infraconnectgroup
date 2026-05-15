import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Calendar, MapPin, Plus, Pencil, Trash2, Users, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/admin/events")({
  component: AdminEventsPage,
});

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  created_at: string;
};

type Registration = {
  user_id: string;
  created_at: string;
  full_name: string | null;
  company: string | null;
  email: string | null;
};

function AdminEventsPage() {
  const [items, setItems] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);
  const [viewRegs, setViewRegs] = useState<EventRow | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false });
    setItems((data as EventRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function remove(id: string) {
    if (!confirm("Dit event verwijderen? Aanmeldingen worden ook verwijderd.")) return;
    await supabase.from("events").delete().eq("id", id);
    await load();
  }

  const now = new Date();
  const upcoming = items.filter((e) => new Date(e.event_date) >= now);
  const past = items.filter((e) => new Date(e.event_date) < now);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan en beheer bijeenkomsten voor leden.</p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-[var(--accent-light)]"
        >
          <Plus size={16} /> Nieuw event
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <Section title="Komende events" items={upcoming} onEdit={setEditing} onDelete={remove} onRegs={setViewRegs} empty="Nog geen komende events." />
          <Section title="Geweest" items={past} onEdit={setEditing} onDelete={remove} onRegs={setViewRegs} empty="Geen eerdere events." muted />
        </>
      )}

      {editing && (
        <EventDialog
          event={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
      {viewRegs && <RegistrationsDialog event={viewRegs} onClose={() => setViewRegs(null)} />}
    </AdminShell>
  );
}

function Section({
  title, items, onEdit, onDelete, onRegs, empty, muted,
}: {
  title: string;
  items: EventRow[];
  onEdit: (e: EventRow) => void;
  onDelete: (id: string) => void;
  onRegs: (e: EventRow) => void;
  empty: string;
  muted?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <div key={e.id} className={`rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)] ${muted ? "opacity-75" : ""}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                    <Calendar size={12} />
                    {new Date(e.event_date).toLocaleString("nl-NL", { dateStyle: "long", timeStyle: "short" })}
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold">{e.title}</h3>
                  {e.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {e.location}</p>}
                  {e.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onRegs(e)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                    <Users size={14} /> Aanmeldingen
                  </button>
                  <button onClick={() => onEdit(e)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                    <Pencil size={14} /> Bewerken
                  </button>
                  <button onClick={() => onDelete(e.id)} className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-background px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50">
                    <Trash2 size={14} /> Verwijderen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventDialog({ event, onClose, onSaved }: { event: EventRow | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [eventDate, setEventDate] = useState(event ? toLocalInput(event.event_date) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!title.trim() || !eventDate) { setErr("Titel en datum zijn verplicht."); return; }
    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      event_date: new Date(eventDate).toISOString(),
    };
    const { error } = event
      ? await supabase.from("events").update(payload).eq("id", event.id)
      : await supabase.from("events").insert(payload);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{event ? "Event bewerken" : "Nieuw event"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <Field label="Titel *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </Field>
          <Field label="Datum & tijd *">
            <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </Field>
          <Field label="Locatie">
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </Field>
          <Field label="Beschrijving">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </Field>
          {err && <p className="text-sm text-rose-700">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary">Annuleren</button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-[var(--accent-light)] disabled:opacity-60">
              {busy && <Loader2 size={14} className="animate-spin" />} Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function RegistrationsDialog({ event, onClose }: { event: EventRow; onClose: () => void }) {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from("event_registrations")
        .select("user_id, created_at")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true });
      if (error) console.error("[admin.events] registrations:", error);
      const list = (rows as { user_id: string; created_at: string }[]) ?? [];
      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      let profilesById = new Map<string, { full_name: string | null; company: string | null; email: string | null }>();
      if (ids.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, company, email")
          .in("id", ids);
        if (pErr) console.error("[admin.events] profiles:", pErr);
        profilesById = new Map((profs ?? []).map((p: { id: string; full_name: string | null; company: string | null; email: string | null }) => [p.id, p]));
      }
      setRegs(list.map((r) => {
        const p = profilesById.get(r.user_id);
        return {
          user_id: r.user_id,
          created_at: r.created_at,
          full_name: p?.full_name ?? null,
          company: p?.company ?? null,
          email: p?.email ?? null,
        };
      }));
      setLoading(false);
    })();
  }, [event.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Aanmeldingen</h2>
            <p className="text-xs text-muted-foreground">{event.title}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={18} /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="animate-spin" /></div>
        ) : regs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">Nog geen aanmeldingen.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {regs.map((r) => (
              <li key={r.user_id} className="flex items-start justify-between gap-4 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{r.full_name ?? "—"}</div>
                  {r.company && <div className="text-xs text-muted-foreground">{r.company}</div>}
                  {r.email && <div className="text-xs text-muted-foreground break-all">{r.email}</div>}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("nl-NL")}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Totaal: {regs.length}</p>
      </div>
    </div>
  );
}
