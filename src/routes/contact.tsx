import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { useState, FormEvent } from "react";
import { Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Businessclub Al Islah" },
      { name: "description", content: "Neem contact op met Businessclub Al Islah in Deventer." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
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
                <span className="rounded-md bg-primary/10 p-2 text-primary"><MapPin size={18} /></span>
                <div>
                  <div className="font-semibold text-foreground">Adres</div>
                  <div className="text-muted-foreground">Deventer, Nederland</div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="rounded-md bg-primary/10 p-2 text-primary"><Mail size={18} /></span>
                <div>
                  <div className="font-semibold text-foreground">E-mail</div>
                  <a href="mailto:info@alislah.nl" className="text-muted-foreground hover:text-primary">info@alislah.nl</a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="rounded-md bg-primary/10 p-2 text-primary"><Phone size={18} /></span>
                <div>
                  <div className="font-semibold text-foreground">Telefoon</div>
                  <span className="text-muted-foreground">Op aanvraag</span>
                </div>
              </li>
            </ul>

            <div className="mt-8 overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]">
              <iframe
                title="Locatie Deventer"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2444.3!2d6.158!3d52.255!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47b81dc3f9a3a6a3%3A0x0!2sDeventer!5e0!3m2!1snl!2snl!4v1700000000000"
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
              <h3 className="mt-4 font-display text-xl font-bold text-foreground">Bericht verzonden</h3>
              <p className="mt-2 text-sm text-muted-foreground">We nemen zo snel mogelijk contact met je op.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Naam</label>
                <input required className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">E-mail</label>
                <input type="email" required className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Bericht</label>
                <textarea rows={5} required className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <button className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-light)]">
                Verstuur bericht
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
