import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search } from "lucide-react";

export const Route = createFileRoute("/portaal/leden")({
  component: MembersPage,
});

type Profile = { id: string; full_name: string | null; company_name: string | null; avatar_url: string | null; bio: string | null };

function MembersPage() {
  const [items, setItems] = useState<Profile[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,company_name,avatar_url,bio").order("full_name", { ascending: true });
      setItems((data as Profile[]) ?? []);
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
          <div key={p.id} className="rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)]">
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
            {p.bio && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.bio}</p>}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">Geen leden gevonden.</p>
        )}
      </div>
    </PortalShell>
  );
}
