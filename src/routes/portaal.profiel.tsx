import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { useEffect, useRef, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";

export const Route = createFileRoute("/portaal/profiel")({
  component: ProfilePage,
});

type Profile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
};

function ProfilePage() {
  const { user } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setP((data as Profile) ?? { id: user.id, full_name: "", company_name: "", email: user.email ?? "", phone: "", bio: "", avatar_url: null });
    })();
  }, [user]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !p) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("profiles").upsert({ ...p, id: user.id });
    setBusy(false);
    setMsg(error ? { k: "err", t: error.message } : { k: "ok", t: "Profiel opgeslagen." });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setBusy(true); setMsg(null);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setBusy(false); setMsg({ k: "err", t: upErr.message }); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("profiles").upsert({ ...(p ?? { id: user.id }), id: user.id, avatar_url: url });
    setP((prev) => prev ? { ...prev, avatar_url: url } : prev);
    setBusy(false); setMsg({ k: "ok", t: "Foto bijgewerkt." });
  }

  if (!p) return <PortalShell><div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div></PortalShell>;

  return (
    <PortalShell>
      <h1 className="font-display text-3xl font-bold">Mijn profiel</h1>
      <p className="mt-1 text-sm text-muted-foreground">Beheer je gegevens en zichtbaarheid in het ledenoverzicht.</p>

      <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-5">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-light)] font-display text-2xl font-bold text-primary-foreground">
              {(p.full_name ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60">
              <Upload size={14} /> Profielfoto uploaden
            </button>
            <p className="mt-1 text-xs text-muted-foreground">JPG of PNG, max ~5 MB.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Volledige naam" value={p.full_name ?? ""} onChange={(v) => setP({ ...p, full_name: v })} />
          <Field label="Bedrijf" value={p.company_name ?? ""} onChange={(v) => setP({ ...p, company_name: v })} />
          <Field label="E-mail" type="email" value={p.email ?? ""} onChange={(v) => setP({ ...p, email: v })} />
          <Field label="Telefoon" value={p.phone ?? ""} onChange={(v) => setP({ ...p, phone: v })} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Korte bio</label>
          <textarea rows={4} value={p.bio ?? ""} onChange={(e) => setP({ ...p, bio: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        {msg && <p className={`text-sm ${msg.k === "ok" ? "text-emerald-700" : "text-destructive"}`}>{msg.t}</p>}

        <button disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-light)] disabled:opacity-60">
          {busy && <Loader2 size={14} className="animate-spin" />} Opslaan
        </button>
      </form>
    </PortalShell>
  );
}

function Field({ label, value, onChange, type = "text", readOnly }: { label: string; value: string; onChange?: (v: string) => void; type?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input type={type} value={value} readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)} className={cn("w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20", readOnly && "bg-muted/50 cursor-not-allowed")} />
    </div>
  );
}
