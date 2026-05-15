import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { Check } from "lucide-react";

export const Route = createFileRoute("/lidmaatschap")({
  head: () => ({
    meta: [
      { title: "Lidmaatschap — Businessclub Al Islah" },
      { name: "description", content: "Drie lidmaatschapspakketten: Brons, Zilver en Goud. Kies wat past bij jouw ambitie." },
    ],
  }),
  component: MembershipPage,
});

const tiers = [
  {
    id: "brons", name: "Brons", price: "€ 10.000", per: "/ jaar",
    features: ["Toegang tot netwerkbijeenkomsten", "Online ledenoverzicht", "Logo op website"],
    highlight: false,
  },
  {
    id: "zilver", name: "Zilver", price: "€ 15.000", per: "/ jaar",
    features: ["Alles uit Brons", "Toegang tot workshops & lezingen", "Islam compliance Quickscan"],
    highlight: true,
  },
  {
    id: "goud", name: "Goud", price: "€ 25.000", per: "/ jaar",
    features: ["Alles uit Zilver", "1-op-1 mentorgesprekken", "Premium evenementen"],
    highlight: false,
  },
] as const;

function MembershipPage() {
  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">Lidmaatschap</h1>
          <p className="mt-4 text-lg text-muted-foreground">Kies het pakket dat past bij jouw ambitie.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={`relative flex flex-col rounded-2xl border bg-card p-8 shadow-[var(--shadow-card)] transition-all ${
                t.highlight
                  ? "border-accent ring-2 ring-accent/30 -translate-y-2"
                  : "border-border"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
                  Populair
                </span>
              )}
              <h3 className="font-display text-2xl font-bold text-foreground">{t.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-primary">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.per}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2 text-foreground/90">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/aanmelden"
                search={{ pakket: t.id }}
                className={`mt-8 inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition-all ${
                  t.highlight
                    ? "bg-accent text-accent-foreground shadow-[var(--shadow-gold)] hover:bg-[var(--accent-light)]"
                    : "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                }`}
              >
                Aanmelden voor {t.name}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
