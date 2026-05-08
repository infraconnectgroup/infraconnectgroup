import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { Target, Eye } from "lucide-react";

export const Route = createFileRoute("/missie-visie")({
  head: () => ({
    meta: [
      { title: "Missie & Visie — Businessclub Al Islah" },
      { name: "description", content: "Onze missie en visie: ondernemen versterken vanuit islamitische waarden." },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">Missie & Visie</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            De fundering waarop Businessclub Al Islah is gebouwd.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="mb-5 inline-flex rounded-xl bg-primary/10 p-4 text-primary">
              <Target size={28} />
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground">Missie</h2>
            <p className="mt-4 text-muted-foreground">
              Wij verbinden moslimondernemers in Nederland en bieden een platform
              waar zij elkaar versterken door middel van kennisdeling, samenwerking
              en wederzijdse ondersteuning. Onze activiteiten zijn altijd gestoeld
              op de principes van eerlijkheid, integriteit en sociale
              verantwoordelijkheid.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-foreground/90">
              <li>• Verbinden van ondernemers met gedeelde waarden</li>
              <li>• Faciliteren van kennisuitwisseling en mentorschap</li>
              <li>• Stimuleren van eerlijk en duurzaam zakendoen</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="mb-5 inline-flex rounded-xl bg-accent/10 p-4 text-accent">
              <Eye size={28} />
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground">Visie</h2>
            <p className="mt-4 text-muted-foreground">
              Een sterk en zichtbaar netwerk van moslimondernemers dat een
              waardevolle bijdrage levert aan de Nederlandse economie en
              samenleving — herkenbaar door professionaliteit, integriteit en
              maatschappelijke betrokkenheid.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-foreground/90">
              <li>• Een bloeiende gemeenschap van professionals</li>
              <li>• Voorbeeldfunctie in ethisch ondernemen</li>
              <li>• Positieve impact op lokale en nationale economie</li>
            </ul>
          </article>
        </div>
      </section>
    </SiteLayout>
  );
}
