# Plan: admin-aanmeldingen zichtbaar maken op `/admin/events`

## Wat ik ga doen
1. Verplaatsen van het ophalen van event-aanmeldingen uit de browser naar een serverfunctie.
2. Die serverfunctie alleen toegankelijk maken voor admins en daar de registraties plus profieldata ophalen.
3. De admin popup op `/admin/events` aanpassen zodat die die serverfunctie gebruikt in plaats van de directe browserquery.
4. Controleren of de profielvelden die getoond worden (`full_name`, `company`) netjes afgehandeld worden als ze leeg zijn.
5. Valideren dat de admin nu wél registraties ziet terwijl gewone leden nog steeds alleen hun eigen data zien.

## Waarom dit de juiste fix is
- De huidige adminpagina gebruikt de normale client-side databaseclient, dus bestaande Row Level Security blijft actief.
- Daardoor ziet een admin waarschijnlijk alleen zijn eigen registraties of helemaal niets.
- Een admin-serverfunctie is hier de veiligste en meest gerichte oplossing: geen open SELECT-policy nodig voor iedereen, en geen onnodige versoepeling van databasebeveiliging.

## Technische aanpak
- Nieuwe `createServerFn` toevoegen voor het ophalen van registraties per event.
- In die functie admin-rechten controleren op basis van `user_roles`.
- De query server-side uitvoeren met verhoogde rechten of gecontroleerde servertoegang.
- `src/routes/admin.events.tsx` aanpassen om de dialog via die functie te vullen.
- Foutstatus en laadstatus in de dialog behouden of verbeteren.

## Resultaat
Na deze wijziging ziet de admin op `/admin/events` de echte aanmeldingen van leden, zonder de beveiliging voor gewone gebruikers open te zetten.