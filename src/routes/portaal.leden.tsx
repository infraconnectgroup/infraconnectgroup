import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, Phone, Search, Globe, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/portaal/leden")({
  component: MembersPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function MembersPage() {
  const [items, setItems] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch("https://mzgobfulqqabznqflhjq.supabase.co/functions/v1/list-members", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      setItems((json?.members as Profile[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return items;
    return items.filter(p =>
      (p.full_name ?? "").toLowerCase().includes(s) ||
      (p.company_name ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  return (
    <PortalShell>
      <h1 className="font-display text-3xl font-bold">Leden</h1>
      <p className="mt-1 text-sm text-muted-foreground">Maak kennis met de andere leden van onze businessclub.</p>

      <div className="mt-5 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek op naam of bedrijf…"
          className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p)}
            className="group flex flex-col text-left rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <div className="flex items-center gap-3">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-light)] font-display text-lg font-bold text-primary-foreground">
                  {(p.full_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">{p.full_name ?? "Onbekend"}</div>
                <div className="truncate text-xs text-muted-foreground">{p.company_name ?? ""}</div>
              </div>
            </div>
            {(p.email || p.phone || p.website) && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {p.email && (
                  <div className="flex items-center gap-1.5"><Mail size={12} /> <span className="truncate">{p.email}</span></div>
                )}
                {p.phone && (
                  <div className="flex items-center gap-1.5"><Phone size={12} /> <span className="truncate">{p.phone}</span></div>
                )}
                {p.website && (
                  <div className="flex items-center gap-1.5"><Globe size={12} /> <span className="truncate">{p.website}</span></div>
                )}
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground">Bekijk profiel →</div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">Geen leden gevonden.</p>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">{active.full_name ?? "Lid"}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center text-center">
                {active.avatar_url ? (
                  <img src={active.avatar_url} alt="" className="h-28 w-28 rounded-full object-cover" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-light)] font-display text-3xl font-bold text-primary-foreground">
                    {(active.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="mt-4 font-display text-xl font-bold">{active.full_name ?? "Onbekend"}</div>
                {active.company_name && <div className="text-sm text-muted-foreground">{active.company_name}</div>}
              </div>
              <div className="mt-2 space-y-2 text-sm">
                {active.email && (
                  <a href={`mailto:${active.email}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-secondary">
                    <Mail size={14} className="text-muted-foreground" /> <span className="truncate">{active.email}</span>
                  </a>
                )}
                {active.phone && (
                  <a href={`tel:${active.phone}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-secondary">
                    <Phone size={14} className="text-muted-foreground" /> <span className="truncate">{active.phone}</span>
                  </a>
                )}
                {active.website && (
                  <a href={normalizeUrl(active.website)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-secondary">
                    <Globe size={14} className="text-muted-foreground" /> <span className="truncate">{active.website}</span>
                  </a>
                )}
              </div>
              {active.bio && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{active.bio}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}
