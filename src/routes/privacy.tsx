import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacyverklaring — Businessclub Al Islah" },
      { name: "description", content: "Onze privacyverklaring conform de AVG." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/30 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-foreground">Privacyverklaring</h1>
          <p className="mt-3 text-muted-foreground">Laatst bijgewerkt: {new Date().toLocaleDateString("nl-NL")}</p>
        </div>
      </section>
      <section className="py-14">
        <div className="mx-auto max-w-3xl space-y-5 px-4 text-foreground/90 sm:px-6">
          <p>Businessclub Al Islah hecht veel waarde aan de bescherming van jouw persoonsgegevens. In deze privacyverklaring leggen wij uit welke gegevens wij verzamelen, waarom en hoe wij hiermee omgaan, conform de Algemene Verordening Gegevensbescherming (AVG).</p>
          <h2 className="font-display text-xl font-bold">Welke gegevens verzamelen we?</h2>
          <p>Wij verwerken alleen de gegevens die jij zelf aan ons verstrekt via formulieren op deze website (naam, bedrijfsgegevens, contactgegevens, motivatie).</p>
          <h2 className="font-display text-xl font-bold">Doel van de verwerking</h2>
          <p>Jouw gegevens worden gebruikt om je aanmelding te verwerken, contact met je op te nemen en je te informeren over activiteiten van Businessclub Al Islah.</p>
          <h2 className="font-display text-xl font-bold">Bewaartermijn</h2>
          <p>Wij bewaren je gegevens niet langer dan noodzakelijk voor het doel waarvoor ze zijn verzameld of zoals wettelijk vereist.</p>
          <h2 className="font-display text-xl font-bold">Jouw rechten</h2>
          <p>Je hebt het recht om je gegevens in te zien, te corrigeren of te laten verwijderen. Neem hiervoor contact op via info@alislah.nl.</p>
          <h2 className="font-display text-xl font-bold">Cookies</h2>
          <p>Deze website gebruikt uitsluitend functionele cookies die noodzakelijk zijn voor de werking van de site.</p>
        </div>
      </section>
    </SiteLayout>
  );
}
