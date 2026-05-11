import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { useState, FormEvent } from "react";
import { Mail, Phone, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Businessclub Al Islah" },
      { name: "description", content: "Neem contact op met Businessclub Al Islah." },
    ],
  }),
  component: ContactPage,
});

const contactSchema = z.object({
  name: z.string().trim().min(1, "Vereist").max(200),
  email: z.string().trim().email("Ongeldig e-mailadres").max(320),
  message: z.string().trim().min(1, "Schrijf een bericht").max(4000),
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg("");
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const raw = { name: fd.get("name"), email: fd.get("email"), message: fd.get("message") };
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        fe[i.path[0] as string] = i.message;
      });
      setFieldErrors(fe);
      setStatus("idle");
      return;
    }
    const { name, email, message } = parsed.data;
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      "contact-submit",
      { body: { name, email, message } },
    );

    if (error) {
      let msg = error.message;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const j = (await ctx.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* body niet-JSON */
        }
      }
      setErrMsg(msg);
      setStatus("error");
      return;
    }

    if (data?.error) {
      setErrMsg(data.error);
      setStatus("error");
      return;
    }

    if (!data?.ok) {
      setErrMsg("Versturen mislukt. Probeer het opnieuw of mail naar info@alislah.nl.");
      setStatus("error");
      return;
    }

    setSent(true);
    setStatus("idle");
  }

  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/30 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">Contact</h1>
          <p className="mt-3 text-muted-foreground">We horen graag van je.</p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Contactgegevens</h2>
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="rounded-md bg-primary/10 p-2 text-primary">
                  <MapPin size={18} />
                </span>
                <div>
                  <div className="font-semibold text-foreground">Adres</div>
                  <div className="text-muted-foreground">Kennisinstituut Al Islah</div>
                  <div className="text-muted-foreground">Ampsenseweg 8</div>
                  <div className="text-muted-foreground">7241 NB Lochem</div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="rounded-md bg-primary/10 p-2 text-primary">
                  <Mail size={18} />
                </span>
                <div>
                  <div className="font-semibold text-foreground">E-mail</div>
                  <a
                    href="mailto:info@businessclub-alislah.nl"
                    className="text-muted-foreground hover:text-primary"
                  >
                    info@businessclub-alislah.nl
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="rounded-md bg-primary/10 p-2 text-primary">
                  <Phone size={18} />
                </span>
                <div>
                  <div className="font-semibold text-foreground">Telefoon</div>
                  <span className="text-muted-foreground">Op aanvraag</span>
                </div>
              </li>
            </ul>

            <div className="mt-8 overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]">
              <iframe
                title="Locatie Kennisinstituut Al Islah, Lochem"
                src="https://maps.google.com/maps?q=Ampsenseweg+8,+7241+NB+Lochem,+Nederland&hl=nl&z=16&output=embed"
                width="100%"
                height="280"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
              <CheckCircle2 className="text-accent" size={56} />
              <h3 className="mt-4 font-display text-xl font-bold text-foreground">
                Bericht verzonden
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Je bericht is verstuurd. We nemen zo snel mogelijk contact met je op.
              </p>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Naam</label>
                <input
                  name="name"
                  required
                  maxLength={200}
                  autoComplete="name"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">E-mail</label>
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={320}
                  autoComplete="email"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Bericht</label>
                <textarea
                  name="message"
                  rows={5}
                  required
                  maxLength={4000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {fieldErrors.message && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.message}</p>
                )}
              </div>
              {status === "error" && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{errMsg}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-light)] disabled:opacity-60"
              >
                {status === "loading" ? "Versturen…" : "Verstuur bericht"}
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
