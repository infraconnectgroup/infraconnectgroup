## Probleem

Op mobiel (zie screenshot) overlappen de elementen in de admin-header:
- Logo + "Admin"-label
- Nav-tabs "Aanmeldingen" en "Events"
- "Uitloggen"-knop

Alles staat op één rij (`justify-between`) zonder wrap, waardoor "Aanmeldingen" over het "Admin"-logo heen valt en "Uitloggen" half buiten beeld loopt.

## Oplossing

`src/components/admin/AdminShell.tsx` herstructureren naar een twee-rij layout op mobiel:

**Rij 1 (header bar):** logo + "Admin"-label links, "Uitloggen"-knop rechts. E-mail blijft verborgen op mobiel (zoals nu).

**Rij 2 (nav bar):** tabs "Aanmeldingen" en "Events" als eigen rij eronder, full-width, met border-top scheiding. Tabs krijgen iets meer padding zodat ze als tikbare tab-bar aanvoelen.

**Desktop (`sm:` en hoger):** alles terug op één rij zoals nu — logo links, nav centraal, uitloggen rechts. Geen visuele verandering op desktop.

### Technisch

- Header `<div>` op mobiel `flex-col`, op `sm:` `flex-row items-center justify-between`.
- Nav krijgt op mobiel `w-full justify-center border-t border-border` en op `sm:` `w-auto border-t-0`.
- Hoogte van header niet meer fixed `h-16` op mobiel — `min-h-16` of `py-3` zodat twee rijen passen.

Alleen presentational CSS-wijzigingen in één bestand. Geen routes, geen logica.
