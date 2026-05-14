import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { useState, FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, AlertCircle } from "lucide-react";

const searchSchema = z.object({
  pakket: z.enum(["brons", "zilver", "goud"]).optional(),
});

export const Route = createFileRoute("/aanmelden")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Word lid — Businessclub Al Islah" },
      { name: "description", content: "Meld je aan als lid van Businessclub Al Islah." },
    ],
  }),
  component: ApplyPage,
});

const formSchema = z.object({
  company_name: z.string().trim().min(1, "Vereist").max(150),
  full_name: z.string().trim().min(1, "Vereist").max(100),
  email: z.string().trim().email("Ongeldig e-mailadres").max(255),
  phone: z.string().trim().min(6, "Vereist").max(30),
  kvk_number: z.string().trim().min(6, "Vereist").max(20),
  motivation: z.string().trim().min(10, "Schrijf minimaal 10 tekens").max(2000),
  membership_tier: z.enum(["brons", "zilver", "goud"]),
});

function ApplyPage() {
  const { pakket } = Route.useSearch();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fe[i.path[0] as string] = i.message; });
      setFieldErrors(fe);
      setStatus("idle");
      return;
    }
    const { company_name, full_name, email, phone, kvk_number, membership_tier, motivation } = parsed.data;
    const { error } = await supabase.from("applications").insert([{
      company_name,
      full_name,
      email,
      phone,
      kvk_number,
      membership_tier,
      motivation,
    }]);
    if (error) {
      setErrMsg(error.message);
      setStatus("error");
      return;
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <SiteLayout>
        <section className="py-24">
          <div className="mx-auto max-w-xl px-4 text-center">
            <CheckCircle2 className="mx-auto text-accent" size={64} />
            <h1 className="mt-6 font-display text-3xl font-bold text-foreground">Bedankt!</h1>
            <p className="mt-3 text-muted-foreground">
              Je aanmelding is ontvangen. Het bestuur neemt zo snel mogelijk contact met je op.
            </p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/30 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">Word lid</h1>
          <p className="mt-3 text-muted-foreground">Vul het formulier in en sluit je aan bij ons netwerk.</p>
        </div>
      </section>

      <section className="py-14">
        <form onSubmit={onSubmit} className="mx-auto grid max-w-2xl gap-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <Field label="Bedrijfsnaam" name="company_name" error={fieldErrors.company_name} />
          <Field label="Contactpersoon" name="full_name" error={fieldErrors.full_name} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-mail" name="email" type="email" error={fieldErrors.email} />
            <Field label="Telefoon" name="phone" type="tel" error={fieldErrors.phone} />
          </div>
          <Field label="KvK-nummer" name="kvk_number" error={fieldErrors.kvk_number} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Pakketkeuze</label>
            <select
              name="membership_tier"
              defaultValue={pakket ?? ""}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="" disabled>Kies een pakket…</option>
              <option value="brons">Brons — € 10.000/jaar</option>
              <option value="zilver">Zilver — € 15.000/jaar</option>
              <option value="goud">Goud — € 25.000/jaar</option>
            </select>
            {fieldErrors.membership_tier && <p className="mt-1 text-xs text-destructive">{fieldErrors.membership_tier}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Motivatie</label>
            <textarea
              name="motivation"
              rows={5}
              required
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Vertel kort waarom je lid wilt worden…"
            />
            {fieldErrors.motivation && <p className="mt-1 text-xs text-destructive">{fieldErrors.motivation}</p>}
          </div>

          {status === "error" && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{errMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--accent-light)] disabled:opacity-60"
          >
            {status === "loading" ? "Versturen…" : "Aanmelding versturen"}
          </button>
        </form>
      </section>
    </SiteLayout>
  );
}

function Field({ label, name, type = "text", error }: { label: string; name: string; type?: string; error?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <input
        name={name}
        type={type}
        required
        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
