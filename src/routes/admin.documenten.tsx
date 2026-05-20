import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Download,
  Loader2,
  X,
  Upload,
  User as UserIcon,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/admin/documenten")({
  component: AdminDocumentenPage,
});

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_public: boolean;
  member_id: string | null;
  uploaded_by: string | null;
  created_at: string;
};

type Member = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
};

function AdminDocumentenPage() {
  const [items, setItems] = useState<DocumentRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DocumentRow | { mode: "new"; isPublic: boolean } | null>(
    null,
  );

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as DocumentRow[]) ?? []);
    setLoading(false);
  }

  async function loadMembers() {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    const res = await fetch(
      "https://mzgobfulqqabznqflhjq.supabase.co/functions/v1/list-members",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = await res.json().catch(() => ({}));
    setMembers((json?.members as Member[]) ?? []);
  }

  useEffect(() => {
    void load();
    void loadMembers();
  }, []);

  const memberMap = useMemo(() => {
    const m = new Map<string, Member>();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

  const privates = items.filter((d) => !d.is_public);
  const publics = items.filter((d) => d.is_public);

  async function remove(doc: DocumentRow) {
    if (!confirm(`Document "${doc.title}" verwijderen?`)) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    await load();
  }

  async function download(doc: DocumentRow) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
    if (error || !data?.signedUrl) {
      alert("Download mislukt: " + (error?.message ?? "onbekende fout"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Documenten</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Beheer privé documenten per lid en algemene documenten voor alle leden.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          <Section
            title="Privé documenten"
            subtitle="Persoonlijke documenten gekoppeld aan één lid. Zichtbaar voor admins en het gekoppelde lid."
            icon={<UserIcon size={16} className="text-accent" />}
            items={privates}
            memberMap={memberMap}
            onNew={() => setEditing({ mode: "new", isPublic: false })}
            onEdit={setEditing}
            onDelete={remove}
            onDownload={download}
            empty="Nog geen privé documenten."
          />
          <Section
            title="Algemene documenten"
            subtitle="Documenten zichtbaar voor alle leden — nieuwsbrieven, handleidingen, mededelingen."
            icon={<Globe size={16} className="text-accent" />}
            items={publics}
            memberMap={memberMap}
            onNew={() => setEditing({ mode: "new", isPublic: true })}
            onEdit={setEditing}
            onDelete={remove}
            onDownload={download}
            empty="Nog geen algemene documenten."
          />
        </>
      )}

      {editing && (
        <DocumentDialog
          doc={"mode" in editing ? null : editing}
          isPublic={"mode" in editing ? editing.isPublic : editing.is_public}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </AdminShell>
  );
}

function Section({
  title,
  subtitle,
  icon,
  items,
  memberMap,
  onNew,
  onEdit,
  onDelete,
  onDownload,
  empty,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: DocumentRow[];
  memberMap: Map<string, Member>;
  onNew: () => void;
  onEdit: (d: DocumentRow) => void;
  onDelete: (d: DocumentRow) => void;
  onDownload: (d: DocumentRow) => void;
  empty: string;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            {icon} {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-[var(--accent-light)]"
        >
          <Plus size={16} /> Upload document
        </button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((d) => {
            const m = d.member_id ? memberMap.get(d.member_id) : null;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                      <FileText size={12} />
                      {new Date(d.created_at).toLocaleDateString("nl-NL", {
                        dateStyle: "long",
                      })}
                    </div>
                    <h3 className="mt-1 font-display text-lg font-bold">{d.title}</h3>
                    {d.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                    )}
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {d.file_name}
                      {d.size_bytes ? ` • ${formatSize(d.size_bytes)}` : ""}
                    </p>
                    {!d.is_public && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <UserIcon size={12} />
                        {m
                          ? `${m.full_name ?? m.email ?? d.member_id} ${m.company_name ? `(${m.company_name})` : ""}`
                          : (d.member_id ?? "—")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onDownload(d)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                    >
                      <Download size={14} /> Downloaden
                    </button>
                    <button
                      onClick={() => onEdit(d)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                    >
                      <Pencil size={14} /> Bewerken
                    </button>
                    <button
                      onClick={() => onDelete(d)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-background px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 size={14} /> Verwijderen
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function DocumentDialog({
  doc,
  isPublic,
  members,
  onClose,
  onSaved,
}: {
  doc: DocumentRow | null;
  isPublic: boolean;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [description, setDescription] = useState(doc?.description ?? "");
  const [memberId, setMemberId] = useState(doc?.member_id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!title.trim()) {
      setErr("Titel is verplicht.");
      return;
    }
    if (!isPublic && !memberId) {
      setErr("Selecteer een lid voor een privé document.");
      return;
    }
    if (!doc && !file) {
      setErr("Kies een bestand om te uploaden.");
      return;
    }

    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;

      let storagePath = doc?.storage_path ?? "";
      let fileName = doc?.file_name ?? "";
      let mimeType = doc?.mime_type ?? null;
      let sizeBytes = doc?.size_bytes ?? null;

      if (file) {
        const safe = sanitizeFilename(file.name);
        const uuid = crypto.randomUUID();
        storagePath = isPublic
          ? `public/${uuid}-${safe}`
          : `private/${memberId}/${uuid}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });
        if (upErr) throw upErr;
        fileName = file.name;
        mimeType = file.type || null;
        sizeBytes = file.size;

        // Replace old file when editing with a new upload
        if (doc && doc.storage_path && doc.storage_path !== storagePath) {
          await supabase.storage.from("documents").remove([doc.storage_path]);
        }
      }

      if (doc) {
        const { error } = await supabase
          .from("documents")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            storage_path: storagePath,
            file_name: fileName,
            mime_type: mimeType,
            size_bytes: sizeBytes,
            member_id: isPublic ? null : memberId,
            is_public: isPublic,
          })
          .eq("id", doc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documents").insert({
          title: title.trim(),
          description: description.trim() || null,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          member_id: isPublic ? null : memberId,
          is_public: isPublic,
          uploaded_by: uid,
        });
        if (error) throw error;
      }

      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">
            {doc ? "Document bewerken" : isPublic ? "Algemeen document" : "Privé document"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Titel *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Omschrijving</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {!isPublic && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Lid *</span>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                disabled={!!doc}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              >
                <option value="">— Kies lid —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? m.email ?? m.id}
                    {m.company_name ? ` (${m.company_name})` : ""}
                  </option>
                ))}
              </select>
              {doc && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Het gekoppelde lid kan niet gewijzigd worden — verwijder en upload opnieuw.
                </span>
              )}
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Bestand {doc ? "(optioneel — laat leeg om huidige te behouden)" : "*"}
            </span>
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm">
              <Upload size={14} className="text-muted-foreground" />
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="flex-1 text-xs"
              />
            </div>
            {doc && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Huidig: {doc.file_name}
              </span>
            )}
          </label>
          {err && <p className="text-sm text-rose-700">{err}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-[var(--accent-light)] disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
