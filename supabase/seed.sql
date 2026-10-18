-- Productie-seed: referentiedata die het portaal nodig heeft om te werken.
-- Bevat GEEN agenten, architecten of orders; die staan in demo-seed.sql.
--
-- Idempotent: dit bestand mag opnieuw worden gedraaid.

-- ===========================================================================
-- postcode_provinces
-- ===========================================================================
-- LET OP — lees dit voordat je op de regioclaim vertrouwt.
--
-- Er bestaat geen officiële tabel van 4-cijferige postcodereeksen per
-- provincie. Het CBS geeft aan dat zo'n overzicht niet kant-en-klaar bestaat
-- en afgeleid moet worden via postcode -> gemeente -> provincie. Een
-- PC4-gebied kan bovendien over een provinciegrens heen liggen.
--
-- Onderstaande reeksen zijn de gangbare indeling en kloppen voor verreweg de
-- meeste adressen, maar zijn een BENADERING. Controleer ze voor de gebieden
-- waar Koreman daadwerkelijk regioclaims op afgeeft.
--
-- Corrigeren kan zonder deze lijst te herschrijven: voeg een SMALLERE reeks
-- toe (desnoods één postcode, postcode_from = postcode_to). province_for_postcode()
-- kiest altijd de smalste reeks die past. Onderaan staan een paar bekende
-- uitzonderingen als voorbeeld.

insert into public.postcode_provinces (postcode_from, postcode_to, province) values
  (1000, 1299, 'Noord-Holland'),
  (1300, 1379, 'Flevoland'),
  (1380, 1399, 'Noord-Holland'),
  (1400, 1699, 'Noord-Holland'),
  (1700, 1999, 'Noord-Holland'),
  (2000, 2199, 'Noord-Holland'),
  (2200, 2999, 'Zuid-Holland'),
  (3000, 3399, 'Zuid-Holland'),
  (3400, 3999, 'Utrecht'),
  (4000, 4199, 'Gelderland'),
  (4200, 4299, 'Zuid-Holland'),
  (4300, 4599, 'Zeeland'),
  (4600, 4999, 'Noord-Brabant'),
  (5000, 5399, 'Noord-Brabant'),
  (5400, 5799, 'Noord-Brabant'),
  (5800, 5999, 'Limburg'),
  (6000, 6499, 'Limburg'),
  (6500, 6999, 'Gelderland'),
  (7000, 7399, 'Gelderland'),
  (7400, 7799, 'Overijssel'),
  (7800, 7999, 'Drenthe'),
  (8000, 8199, 'Overijssel'),
  (8200, 8399, 'Flevoland'),
  (8400, 8999, 'Friesland'),
  (9000, 9299, 'Friesland'),
  (9300, 9499, 'Drenthe'),
  (9500, 9999, 'Groningen')
on conflict (postcode_from, postcode_to) do update
set province = excluded.province;

-- Bekende uitzonderingen: smallere reeksen winnen van de brede reeks hierboven.
insert into public.postcode_provinces (postcode_from, postcode_to, province) values
  (1391, 1391, 'Utrecht'),        -- Abcoude
  (1393, 1393, 'Utrecht'),        -- Nigtevecht
  (5300, 5305, 'Gelderland')      -- Zaltbommel
on conflict (postcode_from, postcode_to) do update
set province = excluded.province;

-- ===========================================================================
-- collections
-- ===========================================================================
insert into public.collections (name, description, is_exclusive) values
  ('Strata',   'Gelaagde structuren, wol en zijde.',          false),
  ('Forma',    'Grafische vormen, strak afgewerkt.',          false),
  ('Flatwave', 'Vlakgeweven, licht van gewicht.',             false),
  ('Terra',    'Aardetinten, natuurlijke vezels.',            false),
  ('Nuance',   'Subtiele kleurverlopen, hoogpolig.',          false)
on conflict (name) do update
set description = excluded.description;
