import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});

type Application = {
  id: string;
  company_name: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  kvk_number: string | null;
  motivation: string | null;
  membership_tier: string | null;
  // legacy fallbacks
  bedrijfsnaam?: string | null;
  contactpersoon?: string | null;
  telefoon?: string | null;
  kvk_nummer?: string | null;
  motivatie?: string | null;
  pakket?: string | null;
  status: string | null;
  admin_note?: string | null;
  created_at: string;
};

function v(app: Application) {
  return {
    company: app.company_name ?? app.bedrijfsnaam ?? "",
    contact: app.full_name ?? app.contactpersoon ?? "",
    phone: app.phone ?? app.telefoon ?? "",
    kvk: app.kvk_number ?? app.kvk_nummer ?? "",
    motivation: app.motivation ?? app.motivatie ?? "",
    tier: app.membership_tier ?? app.pakket ?? "",
  };
}

function AdminPage() {
  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold text-foreground">Aanmeldingen</h1>
      <p className="mt-1 text-sm text-muted-foreground">Beheer en beoordeel binnenkomende lidmaatschapsaanvragen.</p>
      <div className="mt-6">
        <ApplicationsList />
      </div>
    </AdminShell>
  );
}

function ApplicationsList() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as Application[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function normStatus(s: string | null | undefined): "pending" | "accepted" | "rejected" {
    const v = (s ?? "").toLowerCase();
    if (["accepted", "approved", "goedgekeurd", "geaccepteerd"].includes(v)) return "accepted";
    if (["rejected", "declined", "afgewezen"].includes(v)) return "rejected";
    return "pending";
  }
  const filtered = items.filter((i) => filter === "all" ? true : normStatus(i.status) === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { v: "all", l: "Alle", c: items.length },
          { v: "pending", l: "Open", c: items.filter(i => (i.status ?? "pending") === "pending").length },
          { v: "accepted", l: "Geaccepteerd", c: items.filter(i => i.status === "accepted").length },
          { v: "rejected", l: "Afgewezen", c: items.filter(i => i.status === "rejected").length },
        ].map((b) => (
          <button key={b.v} onClick={() => setFilter(b.v)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === b.v ? "bg-primary text-primary-foreground" : "bg-background border border-border hover:bg-secondary"}`}>
            {b.l} <span className="ml-1 opacity-70">({b.c})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">Geen aanmeldingen.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => <ApplicationCard key={a.id} app={a} onChange={load} />)}
        </div>
      )}
    </div>
  );
}

function statusBadge(status: string | null) {
  const s = status ?? "pending";
  const map: Record<string, { c: string; icon: typeof Clock; l: string }> = {
    pending: { c: "bg-amber-100 text-amber-700", icon: Clock, l: "Open" },
    accepted: { c: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, l: "Geaccepteerd" },
    rejected: { c: "bg-rose-100 text-rose-700", icon: XCircle, l: "Afgewezen" },
  };
  const m = map[s] ?? map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${m.c}`}>
      <Icon size={12} /> {m.l}
    </span>
  );
}

function ApplicationCard({ app, onChange }: { app: Application; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(app.admin_note ?? "");
  const [busy, setBusy] = useState<"" | "accept" | "reject" | "save">("");
  const [msg, setMsg] = useState("");

  const vw = v(app);

  async function updateStatus(status: "accepted" | "rejected") {
    setBusy(status === "accepted" ? "accept" : "reject");
    setMsg("");
    try {
      if (status === "accepted") {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Geen actieve sessie. Log opnieuw in.");

        const SUPABASE_URL = "https://mzgobfulqqabznqflhjq.supabase.co";
        const SUPABASE_ANON = "sb_publishable_uL2hLYBKeK3JIAs0wbXcXQ_dzcF78Bh";
        const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-application`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON,
          },
          body: JSON.stringify({
            application_id: app.id,
            email: app.email,
            full_name: vw.contact,
            company_name: vw.company,
            membership_tier: vw.tier,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `Functie faalde (${res.status})`);
      } else {
        const { error } = await supabase
          .from("applications")
          .update({ status, admin_note: note || null })
          .eq("id", app.id);
        if (error) throw error;
      }
      onChange();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setBusy("");
    }
  }

  async function saveNote() {
    setBusy("save"); setMsg("");
    const { error } = await supabase.from("applications").update({ admin_note: note }).eq("id", app.id);
    setBusy("");
    if (error) setMsg(error.message); else setMsg("Opmerking opgeslagen.");
  }

  return (
    <div className="rounded-xl border border-border bg-background shadow-[var(--shadow-card)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{vw.company}</span>
            {statusBadge(app.status)}
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-medium uppercase text-accent">{vw.tier}</span>
          </div>
          <div className="mt-1 truncate text-sm text-muted-foreground">{vw.contact} • {app.email}</div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{new Date(app.created_at).toLocaleDateString("nl-NL")}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Contactpersoon" value={vw.contact} />
            <Detail label="E-mail" value={app.email} />
            <Detail label="Telefoon" value={vw.phone} />
            <Detail label="KvK-nummer" value={vw.kvk} />
            <Detail label="Pakket" value={vw.tier} />
            <Detail label="Aangemeld op" value={new Date(app.created_at).toLocaleString("nl-NL")} />
          </dl>
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Motivatie</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{vw.motivation}</p>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium">Opmerking (intern)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button onClick={saveNote} disabled={busy === "save"} className="mt-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
              {busy === "save" ? "Opslaan…" : "Opmerking opslaan"}
            </button>
          </div>
          {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              disabled={!!busy || app.status === "accepted"}
              onClick={() => updateStatus("accepted")}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "accept" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Accepteren
            </button>
            <button
              disabled={!!busy || app.status === "rejected"}
              onClick={() => updateStatus("rejected")}
              className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-background px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {busy === "reject" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Afwijzen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

