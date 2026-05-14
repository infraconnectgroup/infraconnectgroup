import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

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
  event_id: string;
  user_id: string;
  created_at: string | null;
  full_name: string | null;
  company: string | null;
  email: string | null;
};

type RegistrationsByEvent = Record<string, Registration[]>;

function formatRegistrationDate(value: string | null) {
  if (!value) return "Onbekend";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Onbekend"
    : date.toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
}

function AdminEventsPage() {
  const [items, setItems] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState("");
  const [registrationsByEvent, setRegistrationsByEvent] = useState<RegistrationsByEvent>({});

  async function loadRegistrations(eventIds: string[]) {
    if (eventIds.length === 0) {
      setRegistrationsByEvent({});
      setRegistrationsError("");
      setRegistrationsLoading(false);
      return;
    }

    setRegistrationsLoading(true);
    setRegistrationsError("");

    try {
      const { data: regRows, error: regErr } = await supabase
        .from("event_registrations")
        .select("event_id,user_id,created_at")
        .in("event_id", eventIds)
        .order("created_at", { ascending: true, nullsFirst: false });

      if (regErr) throw new Error(regErr.message);

      const regs = (regRows ?? []) as Array<{ event_id: string; user_id: string; created_at: string | null }>;
      const userIds = [...new Set(regs.map((r) => r.user_id).filter(Boolean))];

      let profilesById = new Map<string, { full_name: string | null; company: string | null; email: string | null }>();
      if (userIds.length > 0) {
        const { data: profileRows, error: profErr } = await supabase
          .from("profiles")
          .select("id,full_name,company,email")
          .in("id", userIds);

        if (profErr) throw new Error(profErr.message);

        profilesById = new Map(
          ((profileRows ?? []) as Array<{ id: string; full_name: string | null; company: string | null; email: string | null }>).map(
            (p) => [p.id, { full_name: p.full_name, company: p.company, email: p.email }],
          ),
        );
      }

      const grouped: RegistrationsByEvent = {};
      for (const row of regs) {
        const profile = profilesById.get(row.user_id);
        if (!grouped[row.event_id]) grouped[row.event_id] = [];
        grouped[row.event_id].push({
          event_id: row.event_id,
          user_id: row.user_id,
          created_at: row.created_at,
          full_name: profile?.full_name ?? null,
          company: profile?.company ?? null,
          email: profile?.email ?? null,
        });
      }

      setRegistrationsByEvent(grouped);
    } catch (error) {
      console.error("[admin.events] failed to load registrations", error);
      setRegistrationsByEvent({});
      setRegistrationsError(error instanceof Error ? error.message : "Registraties konden niet geladen worden.");
    } finally {
      setRegistrationsLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false });

    if (error) {
      console.error("[admin.events] failed to load events", error);
      setItems([]);
      setRegistrationsByEvent({});
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const nextItems = (data as EventRow[]) ?? [];
    setItems(nextItems);
    setLoading(false);
    await loadRegistrations(nextItems.map((item) => item.id));
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-event-registrations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_registrations" },
        () => {
          if (items.length === 0) return;
          void loadRegistrations(items.map((item) => item.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [items]);

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
      ) : loadError ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-destructive">
          {loadError}
        </p>
      ) : (
        <>
          <Section
            title="Komende events"
            items={upcoming}
            onEdit={setEditing}
            onDelete={remove}
            empty="Nog geen komende events."
            expandedEventId={expandedEventId}
            onToggle={(eventId) => setExpandedEventId((current) => (current === eventId ? null : eventId))}
            registrationsByEvent={registrationsByEvent}
            registrationsLoading={registrationsLoading}
            registrationsError={registrationsError}
          />
          <Section
            title="Geweest"
            items={past}
            onEdit={setEditing}
            onDelete={remove}
            empty="Geen eerdere events."
            muted
            expandedEventId={expandedEventId}
            onToggle={(eventId) => setExpandedEventId((current) => (current === eventId ? null : eventId))}
            registrationsByEvent={registrationsByEvent}
            registrationsLoading={registrationsLoading}
            registrationsError={registrationsError}
          />
        </>
      )}

      {editing && (
        <EventDialog
          event={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </AdminShell>
  );
}

function Section({
  title,
  items,
  onEdit,
  onDelete,
  empty,
  muted,
  expandedEventId,
  onToggle,
  registrationsByEvent,
  registrationsLoading,
  registrationsError,
}: {
  title: string;
  items: EventRow[];
  onEdit: (e: EventRow) => void;
  onDelete: (id: string) => void;
  empty: string;
  muted?: boolean;
  expandedEventId: string | null;
  onToggle: (eventId: string) => void;
  registrationsByEvent: RegistrationsByEvent;
  registrationsLoading: boolean;
  registrationsError: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              muted={muted}
              onEdit={onEdit}
              onDelete={onDelete}
              isOpen={expandedEventId === e.id}
              onToggle={onToggle}
              registrations={registrationsByEvent[e.id] ?? []}
              registrationsLoading={registrationsLoading}
              registrationsError={registrationsError}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({
  event,
  muted,
  onEdit,
  onDelete,
  isOpen,
  onToggle,
  registrations,
  registrationsLoading,
  registrationsError,
}: {
  event: EventRow;
  muted?: boolean;
  onEdit: (e: EventRow) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: (eventId: string) => void;
  registrations: Registration[];
  registrationsLoading: boolean;
  registrationsError: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)] ${muted ? "opacity-75" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <Calendar size={12} />
            {new Date(event.event_date).toLocaleString("nl-NL", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </div>
          <h3 className="mt-1 font-display text-lg font-bold">{event.title}</h3>
          {event.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} /> {event.location}
            </p>
          )}
          {event.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
          )}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Users size={12} />
            {registrations.length} {registrations.length === 1 ? "aanmelding" : "aanmeldingen"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onToggle(event.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <Users size={14} /> Deelnemers {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => onEdit(event)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <Pencil size={14} /> Bewerken
          </button>
          <button
            onClick={() => onDelete(event.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-background px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
          >
            <Trash2 size={14} /> Verwijderen
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 border-t border-border pt-4">
          {registrationsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ) : registrationsError ? (
            <p className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-destructive">
              {registrationsError}
            </p>
          ) : registrations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              Nog geen aanmeldingen
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <ul className="divide-y divide-border">
                {registrations.map((registration: Registration) => (
                  <li
                    key={`${registration.user_id}-${registration.created_at ?? "unknown"}`}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {registration.full_name ?? registration.company ?? "Onbekend lid"}
                      </div>
                      {registration.company && (
                        <div className="truncate text-xs text-muted-foreground">{registration.company}</div>
                      )}
                    </div>
                    <div className="min-w-0 text-sm text-muted-foreground">
                      {registration.email ?? "Geen e-mail beschikbaar"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRegistrationDate(registration.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
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
