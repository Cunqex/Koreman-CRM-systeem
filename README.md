# Koreman Agentenportaal

CRM-portaal voor Koreman Maastricht. Agenten leggen hier hun
interieurarchitecten vast, met alle afspraken, activiteiten, projecten en
orders. Koreman ziet alles, keurt orders goed en beoordeelt de prestaties van
de agenten.

Het portaal is ook bewijsvoering: in het contract staat dat de agent
aantoonbaar actief moeite moet steken in elke architect. Activiteiten zijn
daarom niet verwijderbaar, binnen 24 uur bewerkbaar, en elke wijziging komt
met oude en nieuwe waarde in de audit log.

---

## Techniek

| Onderdeel | Keuze |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Routing | React Router met `HashRouter` (nodig voor GitHub Pages) |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions |
| Data | `@supabase/supabase-js` met TanStack Query |
| Formulieren | react-hook-form met zod |
| Grafieken | Recharts |
| Taal | react-i18next, Nederlands standaard, Engels via toggle |
| Hosting | GitHub Pages via GitHub Actions |

Bedragen zijn overal `numeric(12,2)` en **altijd exclusief btw**.

### Beveiliging

De anon key staat publiek in de frontend. Dat mag, want **alle** autorisatie
wordt afgedwongen met Row Level Security op elke tabel en in de
Storage-policies. De frontend-checks zijn alleen cosmetisch. De service role
key komt nooit in de frontend, alleen in Edge Functions.

Twee dingen om te weten:

- **`is_admin()` eist zelf `aal2`.** De MFA-eis zit in de helperfunctie en niet
  in elke policy apart, zodat geen enkele admin-policy hem kan overslaan. Een
  admin zonder tweestapsverificatie kan alleen zijn eigen profiel lezen, net
  genoeg om de frontend naar de MFA-stap te laten sturen.
- **`last_activity_at` en `in_region` zijn niet schrijfbaar voor clients.** Dat
  is een rechtenbeperking op kolomniveau, geen trigger: zo kan een agent geen
  recente activiteit faken om een inactiviteitsmelding te ontlopen.
- **Twee private Storage-buckets**, allebei door de migraties aangemaakt.
  `documents` gebruikt het pad `<architect_id>/…` en volgt de zichtbaarheid
  van de architect; `contracts` gebruikt `<agent_id>/…`, is leesbaar volgens
  `visible_agent_ids()` en alleen door Koreman te vullen. Beide 20 MB per
  bestand.

---

## Stap voor stap opzetten

### 1. Supabase-project aanmaken (EU)

Maak op [supabase.com](https://supabase.com) een nieuw project aan in de regio
**EU Central (Frankfurt)**. Noteer:

- de **Project URL** (`https://<ref>.supabase.co`)
- de **anon public key**
- het **database-wachtwoord**

### 2. Migraties draaien

Met de Supabase CLI:

```bash
npm install -g supabase
supabase link --project-ref <jouw-project-ref>
supabase db push
```

Daarna de referentiedata (provincies en collecties):

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

> **Let op bij de postcodetabel.** Er bestaat geen officiële lijst van
> 4-cijferige postcodereeksen per provincie; het CBS leidt die af via
> postcode → gemeente → provincie, en een PC4-gebied kan over een
> provinciegrens heen liggen. De reeksen in `seed.sql` zijn de gangbare
> indeling en kloppen voor verreweg de meeste adressen, maar zijn een
> **benadering**. Controleer ze voor de gebieden waar Koreman echt
> regioclaims op afgeeft. Corrigeren kan zonder de lijst te herschrijven:
> voeg een smallere reeks toe (desnoods één postcode), want
> `province_for_postcode()` kiest altijd de smalste reeks die past.

### 3. Edge Function deployen

```bash
supabase functions deploy invite-user
```

De functie controleert dat de aanroeper een admin met `aal2` is, nodigt de
gebruiker uit met `auth.admin.inviteUserByEmail` en maakt meteen het profiel
aan met de juiste rol en hoofdagent. Er is geen zelfregistratie.

### 4. MFA aanzetten

In het Supabase-dashboard: **Authentication → Multi-Factor Authentication →
TOTP inschakelen**.

Beheerders zijn verplicht TOTP te gebruiken. Een admin zonder `aal2` wordt na
inloggen naar de enrolment- of verificatiestap gestuurd, en de RLS-policies
geven hem tot die tijd niets vrij.

### 5. pg_cron aanzetten

In het dashboard: **Database → Extensions → `pg_cron` inschakelen**. De
migratie plant daarna zelf de dagelijkse job:

```sql
select cron.schedule(
  'koreman-daily-notifications',
  '0 6 * * *',
  $$ select public.run_daily_notifications(); $$
);
```

Die job maakt elke ochtend meldingen voor inactieve architecten, vervallen
follow-ups en afgeronde contractjaren.

### 6. De eerste admin aanmaken

Maak de gebruiker aan in **Authentication → Users → Add user** (met een
e-mailadres en wachtwoord), en koppel daarna het profiel:

```sql
-- Vul het e-mailadres in dat je zojuist hebt aangemaakt.
insert into public.profiles (id, role, full_name, email, is_active)
select u.id, 'admin', 'Naam Beheerder', u.email, true
from auth.users u
where u.email = 'beheer@koremanmaastricht.nl'
on conflict (id) do update
set role = 'admin', is_active = true;
```

Log daarna in en doorloop de MFA-enrolment. Herhaal dit voor het tweede
Koreman-account. Alle verdere gebruikers gaan via **Gebruikers → uitnodigen**.

### 7. GitHub secrets instellen

In de repo: **Settings → Secrets and variables → Actions**.

Secrets:

| Naam | Waarde |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | de anon public key |

Optionele variable:

| Naam | Waarde |
|---|---|
| `VITE_BASE_PATH` | `/<repo-naam>/`, of `/` bij een eigen domein |

Zonder die variable gebruikt de workflow automatisch `/<repo-naam>/`.

### 8. Pages activeren

**Settings → Pages → Source: GitHub Actions**. Elke push naar `main` bouwt en
publiceert. De workflow staat in `.github/workflows/deploy.yml` en draait
eerst een typecheck.

### 9. Later: eigen domein

Zet `portaal.koremanmaastricht.nl` als CNAME naar `<org>.github.io`, vul het
domein in bij **Settings → Pages → Custom domain**, en zet de variable
`VITE_BASE_PATH` op `/`. Voeg het domein daarna toe bij Supabase onder
**Authentication → URL Configuration → Redirect URLs**, anders werken de
uitnodigings- en wachtwoordlinks niet.

---

## Lokaal ontwikkelen

```bash
npm install
cp .env.example .env   # vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in
npm run dev
```

| Commando | Doet |
|---|---|
| `npm run dev` | ontwikkelserver op <http://localhost:5173> |
| `npm run build` | productiebuild in `dist/` |
| `npm run typecheck` | TypeScript over het hele project |
| `npm run preview` | de productiebuild lokaal bekijken |

De pagina's worden per route apart geladen, dus Recharts en de zwaardere
overzichten zitten niet in de eerste download. Het inlogscherm laadt
daardoor een fractie van de bundel.

---

## Tests

De tests draaien als SQL tegen de database en vereisen geen extra tooling.
Draai ze tegen een **ontwikkeldatabase**, niet tegen productie. Elk bestand
draait in één transactie en eindigt met `rollback`, dus er blijft niets staan.

```bash
psql "$DATABASE_URL" -f supabase/tests/00_helpers.sql \
                     -f supabase/tests/01_rls_test.sql

psql "$DATABASE_URL" -f supabase/tests/00_helpers.sql \
                     -f supabase/tests/02_commission_test.sql
```

Een suite stopt met een exception zodra er iets faalt, zodat een CI-stap rood
wordt. De uitkomst per test verschijnt als `NOTICE`.

**`01_rls_test.sql`** controleert onder meer dat een agent geen data van een
andere agent ziet, dat een subagent niets van zijn hoofdagent ziet terwijl de
hoofdagent zijn subagent wel ziet, dat niemand een activiteit kan verwijderen,
dat een agent een activiteit na 24 uur niet meer kan wijzigen (en binnen 24 uur
wel), dat een agent de orderstatus niet kan wijzigen, geen commissieregels kan
maken en `last_activity_at` niet zelf kan zetten, en dat een admin zonder
`aal2` niets extra's ziet.

**`02_commission_test.sql`** rekent de formule door: met en zonder korting,
korting binnen en boven de speling, een overgedragen architect vóór en ná
`transferred_at`, een uitgesloten architect, de subagent-verdeling (12,5% naar
de hoofdagent, 9% doorgegeven) inclusief het evenredige deel van de
kortingsaftrek, en de verrekening bij retour na betaling.

### Wat wel en niet is nagelopen

Het inlogscherm, de wachtwoord-herstelpagina, de taalwissel NL/EN en de
weergave op mobiel (375 px) zijn in een browser bekeken en werken, zonder
fouten in de console. Typecheck en productiebuild draaien schoon.

De schermen áchter de login zijn nog niet in een browser gezien: daarvoor is
een echt Supabase-project met een ingelogde gebruiker nodig. **De SQL in
`supabase/migrations/` is nog nooit tegen een database uitgevoerd.** Draai
daarom eerst `supabase db push` en daarna de twee testbestanden hieronder;
reken op kinderziektes bij die eerste run.

### Demo-data

```bash
psql "$DATABASE_URL" -f supabase/demo-seed.sql
```

Maak eerst de vier demo-gebruikers aan die bovenin dat bestand staan. Het
script stopt netjes als ze ontbreken en raakt productiedata niet aan.

---

## Commissieberekening

De hele formule staat in `calculate_commission(order_id)`, zodat ze op één
plek aan te passen is.

```
advice_total       = som van advice_price over de orderregels
sale_total         = som van sale_price
discount           = max(0, advice_total - sale_total)
tolerance          = advice_total * price_tolerance_pct / 100
discount_deduction = max(0, discount - tolerance)
commission         = max(0, advice_total * pct / 100 - discount_deduction)
```

`pct` is `own_commission_pct` bij een zelf getekende architect en
`transferred_commission_pct` bij een overgedragen architect. Verzend- en
montagekosten tellen niet mee.

Er is geen commissie als de architect is uitgesloten, als de claim niet bij de
agent ligt, als er geen lopend contract is, of als een overgedragen architect
een order heeft van vóór `transferred_at`.

### Subagenten

Koreman betaalt de volledige commissie aan de **hoofdagent**, berekend met de
percentages uit het contract van de hoofdagent. Wat de hoofdagent doorgeeft
staat in het contract van de subagent en wordt alleen ter informatie
vastgelegd:

- een `commission`-regel voor de hoofdagent, `payable_by = 'koreman'`
- een `subagent_share`-regel voor de subagent, `payable_by = 'parent_agent'`

Koreman-rapportages tellen alleen `payable_by = 'koreman'`, zodat er niets
dubbel wordt geteld.

Het evenredige deel van de kortingsaftrek voor de subagent is
`discount_deduction * subagent_pct / pct`. Bij 9 van de 12,5% is dat 72% van
de aftrek. Voorbeeld met adviesprijs 10.000, korting 1.000 en speling 0:

| | percentage | bedrag |
|---|---|---|
| Hoofdagent (Koreman betaalt) | 12,5% | 1.250 − 1.000 = **250** |
| Subagent (hoofdagent betaalt) | 9% | 900 − 720 = **180** |

Uitbetaling gebeurt buiten het portaal; de ledger geeft alleen inzicht. De
ledger is append-only: correcties zijn nieuwe regels met een verplichte
notitie, nooit een wijziging van een bestaande regel.

---

## Regio

De regio wordt bepaald door het **kantooradres van de architect**, niet door de
projectlocatie:

```
regio = gekozen provincies
      + extra opgenomen postcodereeksen
      - uitgesloten postcodereeksen        (een uitsluiting wint altijd)
```

Valt een architect buiten de regio, dan mag de agent hem wél opslaan, maar
wordt de architect gemarkeerd en krijgt Koreman een melding. Zonder lopend
contract of met een ingetrokken regioclaim geldt alles als binnen regio, zodat
de UI geen loze waarschuwingen toont.

---

## Projectstructuur

```
.github/workflows/deploy.yml   build en deploy naar GitHub Pages
src/
  components/ui/               Card, KpiCard, DataTable, Badge, Tabs,
                               Timeline, Modal, Drawer, EmptyState,
                               ConfirmDialog, formuliervelden
  components/layout/           sidebar, topbar, app-layout, menu-items
  features/                    auth, notifications, search
  locales/                     nl.json en en.json
  lib/                         supabase-client, i18n, formatters
  types/database.ts            TypeScript-spiegel van het SQL-schema
supabase/
  migrations/                  alle schemawijzigingen
  seed.sql                     referentiedata (provincies, collecties)
  demo-seed.sql                fictieve demodata, los van productie
  tests/                       RLS- en commissietests
  functions/invite-user/       uitnodigen door een admin
```

De TypeScript-typen in `src/types/database.ts` worden met de hand
bijgehouden. Opnieuw genereren kan met:

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```
