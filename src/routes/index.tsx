import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { ArrowRight, Users, Handshake, TrendingUp, Sparkles, BookOpen, Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Businessclub Al Islah — Netwerk voor moslimondernemers" },
      { name: "description", content: "Businessclub Al Islah verbindt ondernemers met islamitische waarden. Word lid van ons netwerk." },
      { property: "og:title", content: "Businessclub Al Islah" },
      { property: "og:description", content: "Netwerken, kennis delen en groeien — samen vanuit islamitische waarden." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-[var(--shadow-card)]">
              <Sparkles size={14} /> Businessclub Al Islah
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Samen ondernemen vanuit{" "}
              <span className="text-primary">islamitische waarden</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              Een professioneel netwerk voor ondernemers.
              Verbind, leer en groei samen met gelijkgestemde professionals.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/aanmelden"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground shadow-[var(--shadow-gold)] transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-light)] sm:w-auto"
              >
                Word lid <ArrowRight size={18} />
              </Link>
              <Link
                to="/over-ons"
                className="inline-flex w-full items-center justify-center rounded-md border-2 border-primary bg-background px-7 py-3.5 text-base font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:w-auto"
              >
                Meer info
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mission/Vision */}
      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
              <BookOpen size={26} />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Onze Missie</h2>
            <p className="mt-3 text-muted-foreground">
              Het versterken van moslimondernemers door een netwerk te bieden waar
              kennis, ervaring en kansen worden gedeeld — altijd gebaseerd op
              integriteit en islamitische ethiek.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="mb-4 inline-flex rounded-lg bg-accent/10 p-3 text-accent">
              <Heart size={26} />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Onze Visie</h2>
            <p className="mt-3 text-muted-foreground">
              Een bloeiende gemeenschap van professionele ondernemers die elkaar
              ondersteunen en samen bijdragen aan een rechtvaardige en duurzame
              economie in Nederland.
            </p>
          </div>
        </div>
      </section>

      {/* Voordelen */}
      <section className="bg-secondary/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Waarom lid worden?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Drie kernvoordelen die jouw onderneming verder brengen.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Users, title: "Krachtig netwerk", text: "Ontmoet ondernemers uit diverse sectoren tijdens onze maandelijkse bijeenkomsten." },
              { icon: Handshake, title: "Vertrouwde samenwerking", text: "Werk samen met partners die dezelfde waarden en normen delen." },
              { icon: TrendingUp, title: "Groei & kennis", text: "Workshops, sprekers en mentortrajecten om jouw business naar het volgende niveau te tillen." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="group rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-primary to-[var(--primary-light)] p-3 text-primary-foreground">
                  <Icon size={24} />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-[var(--primary-light)] p-10 text-primary-foreground shadow-[var(--shadow-soft)] sm:p-14">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Klaar om aan te sluiten?</h2>
            <p className="mt-4 text-primary-foreground/90">
              Word vandaag nog onderdeel van een groeiend netwerk van ondernemers.
            </p>
            <Link
              to="/aanmelden"
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground shadow-[var(--shadow-gold)] transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-light)]"
            >
              Word lid <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
