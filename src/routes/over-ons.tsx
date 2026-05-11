import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";

export const Route = createFileRoute("/over-ons")({
  head: () => ({
    meta: [
      { title: "Over ons — Businessclub Al Islah" },
      { name: "description", content: "Maak kennis met Businessclub Al Islah en het bestuur achter ons netwerk van moslimondernemers." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const board = [
    { role: "Voorzitter", name: "Naoufal Bouazza", initials: "NB" },
    { role: "Secretaris", name: "Ahmad Balaksi", initials: "AB" },
    { role: "Adviseur", name: "Mehmet Kılıç", initials: "MK" },
  ];

  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">Over ons</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Businessclub Al Islah is opgericht om moslimondernemers te verbinden,
            inspireren en versterken.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl space-y-6 px-4 text-foreground/90 sm:px-6">
          <p>
            Wij geloven dat ondernemen meer is dan winst maken — het is een vorm van
            dienstbaarheid aan de samenleving en een mogelijkheid om islamitische
            waarden in praktijk te brengen. Wij bouwen aan een netwerk van
            professionals die elkaar versterken, kennis delen en samen groeien.
          </p>
          <p>
            Onze leden zijn actief in uiteenlopende sectoren: van retail en horeca
            tot juridische dienstverlening, IT en consultancy. Wat hen verbindt is
            de overtuiging dat eerlijk zakendoen, vertrouwen en gemeenschapszin
            centraal moeten staan in elke onderneming.
          </p>
          <p>
            Door middel van bijeenkomsten, workshops en
            mentortrajecten bieden wij onze leden een platform om zich
            professioneel én persoonlijk te ontwikkelen.
          </p>
        </div>
      </section>

      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold text-foreground">Het bestuur</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {board.map((m) => (
              <div key={m.name} className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-light)] font-display text-2xl font-bold text-primary-foreground">
                  {m.initials}
                </div>
                <h3 className="font-semibold text-foreground">{m.name}</h3>
                <p className="text-sm text-muted-foreground">{m.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
