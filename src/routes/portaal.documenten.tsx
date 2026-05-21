import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import {
  FileText,
  Download,
  Loader2,
  User as UserIcon,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/portaal/documenten")({
  component: PortalDocumentenPage,
});

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  is_public: boolean;
  member_id: string | null;
  created_at: string;
};

function PortalDocumentenPage() {
  const { user } = useAuth();

  const [mine, setMine] = useState<DocumentRow[]>([]);
  const [publics, setPublics] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      setLoading(true);

      const [{ data: m }, { data: p }] = await Promise.all([
        supabase
          .from("documents")
          .select("*")
          .eq("is_public", false)
          .eq("member_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("documents")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false }),
      ]);

      setMine((m as DocumentRow[]) ?? []);
      setPublics((p as DocumentRow[]) ?? []);

      setLoading(false);
    })();
  }, [user]);

  async function view(doc: DocumentRow) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(
        doc.storage_path,
        5 // korte geldigheid voor bekijken
      );

    if (error || !data?.signedUrl) {
      alert(
        "Openen mislukt: " +
          (error?.message ?? "onbekende fout")
      );
      return;
    }

    window.location.href = data.signedUrl;
  }

  async function download(doc: DocumentRow) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(
        doc.storage_path,
        60,
        {
          download: doc.file_name,
        }
      );

    if (error || !data?.signedUrl) {
      alert(
        "Download mislukt: " +
          (error?.message ?? "onbekende fout")
      );
      return;
    }

    window.location.assign(
  data.signedUrl
);
  }

  return (
    <PortalShell>
      <h1 className="font-display text-3xl font-bold">
        Documenten
      </h1>

      <p className="mt-1 text-sm text-muted-foreground">
        Bekijk je documenten.
      </p>

      {loading ? (
        <div className="mt-6 flex justify-center py-12 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          <DocSection
            title="Mijn documenten"
            subtitle="Alleen zichtbaar voor jou."
            icon={
              <UserIcon
                size={16}
                className="text-accent"
              />
            }
            items={mine}
            empty="Je hebt nog geen persoonlijke documenten."
            onView={view}
            onDownload={download}
          />

          <DocSection
            title="Algemene documenten"
            subtitle="Beschikbaar voor alle leden."
            icon={
              <Globe
                size={16}
                className="text-accent"
              />
            }
            items={publics}
            empty="Geen algemene documenten beschikbaar."
            onView={view}
            onDownload={download}
          />
        </>
      )}
    </PortalShell>
  );
}

function DocSection({
  title,
  subtitle,
  icon,
  items,
  empty,
  onView,
  onDownload,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: DocumentRow[];
  empty: string;
  onView: (d: DocumentRow) => void;
  onDownload: (d: DocumentRow) => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        {icon}
        {title}
      </h2>

      <p className="mt-1 text-xs text-muted-foreground">
        {subtitle}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  <FileText size={12} />
                  {new Date(
                    d.created_at
                  ).toLocaleDateString(
                    "nl-NL",
                    {
                      dateStyle: "long",
                    }
                  )}
                </div>

                <h3 className="mt-1 font-display text-lg font-bold">
                  {d.title}
                </h3>

                {d.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.description}
                  </p>
                )}

                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {d.file_name}
                  {d.size_bytes
                    ? ` • ${formatSize(
                        d.size_bytes
                      )}`
                    : ""}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onView(d)}
                  className="
                    inline-flex flex-1 sm:flex-none
                    items-center justify-center
                    gap-1.5 rounded-md
                    border border-border
                    bg-background
                    px-4 py-2
                    text-sm font-semibold
                    hover:bg-secondary
                  "
                >
                  <FileText size={14} />
                  Bekijken
                </button>

                <button
                  onClick={() => onDownload(d)}
                  className="
                    inline-flex flex-1 sm:flex-none
                    items-center justify-center
                    gap-1.5 rounded-md
                    bg-accent
                    px-4 py-2
                    text-sm font-semibold
                    text-accent-foreground
                    hover:bg-[var(--accent-light)]
                  "
                >
                  <Download size={14} />
                  Downloaden
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;
}
