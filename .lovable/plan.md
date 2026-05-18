## Probleem

Op mobiel zit "Inloggen" verstopt: in de header bar staat alleen het hamburger-icoon, en pas ná het openen van het menu verschijnt een klein slot-icoontje (zonder tekst) onderaan. Gebruikers herkennen dat niet als inlogknop.

## Oplossing

Twee aanpassingen in `src/components/site/Header.tsx`:

1. **Altijd zichtbare "Inloggen"-knop in de mobiele header bar**, links van de hamburger:
   - Tekst "Inloggen" + slot-icoon (`Lock`)
   - Subtiele outline-stijl (border + `text-primary`), zodat de gouden "Word lid"-CTA op desktop visueel dominant blijft
   - Compact (kleine padding) zodat het naast het logo past op smalle schermen
   - Alleen tonen op `md:hidden`

2. **Mobiel uitklapmenu opschonen**:
   - De losse slot-icoon-link onderaan verwijderen (nu dubbelop)
   - "Word lid" blijft als volledige gouden knop in het uitklapmenu

Resultaat: op mobiel zien gebruikers meteen "Inloggen" in de header zonder eerst het menu te hoeven openen, en de inlog-actie is tekstueel duidelijk i.p.v. alleen een icoontje.

## Bestanden

- `src/components/site/Header.tsx` — mobiele inlogknop toevoegen in de header bar; dubbele slot-link uit het uitklapmenu verwijderen.

Geen wijzigingen aan desktop layout, routes of backend.
