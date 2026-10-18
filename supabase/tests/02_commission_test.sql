-- Commissietests: de formule en de ledger.
--   psql "$DATABASE_URL" -f supabase/tests/00_helpers.sql -f supabase/tests/02_commission_test.sql
--
-- Uitgangspunt in alle scenario's: adviesprijs 10.000 excl. btw,
-- eigen percentage 12,5%, overgedragen 5%, doorgeefpercentage subagent 9%.

begin;

delete from koreman_test.results where suite = 'commissie';

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@koreman.test'),
  ('22222222-2222-2222-2222-222222222222', 'agent1@koreman.test'),
  ('44444444-4444-4444-4444-444444444444', 'sub1@koreman.test')
on conflict (id) do nothing;

insert into public.profiles (id, role, full_name, email, parent_agent_id) values
  ('11111111-1111-1111-1111-111111111111', 'admin',    'Koreman Beheer', 'admin@koreman.test',  null),
  ('22222222-2222-2222-2222-222222222222', 'agent',    'Agent Een',      'agent1@koreman.test', null),
  ('44444444-4444-4444-4444-444444444444', 'subagent', 'Subagent Een',   'sub1@koreman.test',
   '22222222-2222-2222-2222-222222222222');

insert into public.contracts
  (id, agent_id, start_date, own_commission_pct, transferred_commission_pct,
   subagent_own_pct, subagent_transferred_pct, price_tolerance_pct, clawback_enabled)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   current_date - 100, 12.5, 5, null, null, 0, true),
  ('aaaaaaaa-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444',
   current_date - 100, 12.5, 5, 9, 4, 0, true);

insert into public.contract_regions (contract_id, province) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Limburg'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Limburg');

-- Zelf getekende architect van de hoofdagent.
insert into public.architects (id, agent_id, first_name, last_name, postcode, origin) values
  ('55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Anna', 'Jansen', '6211 AB', 'agent_signed');

-- Overgedragen architect, overgedragen 30 dagen geleden.
insert into public.architects
  (id, agent_id, first_name, last_name, postcode, origin, transferred_at)
values
  ('55555555-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'Bram', 'Overdracht', '6212 AB', 'koreman_transferred', current_date - 30);

-- Architect van de subagent.
insert into public.architects (id, agent_id, first_name, last_name, postcode, origin) values
  ('77777777-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444',
   'Carla', 'Peters', '6411 AB', 'agent_signed');

-- Hulpje: maak een order met één regel en geef de id terug.
create or replace function koreman_test.make_order(
  p_id uuid,
  p_architect uuid,
  p_agent uuid,
  p_order_date date,
  p_advice numeric,
  p_sale numeric
)
returns uuid
language plpgsql
as $$
begin
  insert into public.orders (id, architect_id, agent_id, order_date, reference, status)
  values (p_id, p_architect, p_agent, p_order_date, 'T-' || left(p_id::text, 4), 'ingediend');

  insert into public.order_lines (order_id, design_name, quantity, advice_price, sale_price)
  values (p_id, 'Teststuk', 1, p_advice, p_sale);

  return p_id;
end;
$$;

-- ===========================================================================
-- 1. Geen korting: 12,5% van 10.000 = 1.250
-- ===========================================================================
select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000001',
  '55555555-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 10000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000001');
  perform koreman_test.check('commissie', 'zonder korting: 12,5% van 10.000 = 1.250',
    c.eligible and c.commission = 1250 and c.discount_deduction = 0,
    format('commissie %s, aftrek %s', c.commission, c.discount_deduction));
end
$$;

-- ===========================================================================
-- 2. Korting 1.000, speling 0: 1.250 - 1.000 = 250
-- ===========================================================================
select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000002',
  '55555555-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 9000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000002');
  perform koreman_test.check('commissie', 'korting 1.000 zonder speling: 250',
    c.commission = 250 and c.discount = 1000 and c.discount_deduction = 1000,
    format('commissie %s, korting %s, aftrek %s', c.commission, c.discount, c.discount_deduction));
end
$$;

-- ===========================================================================
-- 3. Korting binnen de speling (5% = 500, korting 400): volle commissie
-- ===========================================================================
update public.contracts set price_tolerance_pct = 5
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000003',
  '55555555-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 9600);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000003');
  perform koreman_test.check('commissie', 'korting 400 binnen speling 500: volle 1.250',
    c.commission = 1250 and c.discount_deduction = 0 and c.tolerance = 500,
    format('commissie %s, speling %s, aftrek %s', c.commission, c.tolerance, c.discount_deduction));
end
$$;

-- ===========================================================================
-- 4. Korting boven de speling (korting 1.000, speling 500): 1.250 - 500 = 750
-- ===========================================================================
select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000004',
  '55555555-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 9000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000004');
  perform koreman_test.check('commissie', 'korting 1.000 boven speling 500: 750',
    c.commission = 750 and c.discount_deduction = 500,
    format('commissie %s, aftrek %s', c.commission, c.discount_deduction));
end
$$;

update public.contracts set price_tolerance_pct = 0
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ===========================================================================
-- 5. Overgedragen architect, order VOOR de overdracht: geen commissie
-- ===========================================================================
select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000005',
  '55555555-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  current_date - 60, 10000, 10000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000005');
  perform koreman_test.check('commissie', 'overgedragen architect vóór overdracht: geen commissie',
    not c.eligible and c.ineligible_reason = 'order_before_transfer',
    format('eligible %s, reden %s', c.eligible, c.ineligible_reason));
end
$$;

-- ===========================================================================
-- 6. Overgedragen architect, order NA de overdracht: 5% = 500
-- ===========================================================================
select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000006',
  '55555555-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  current_date - 10, 10000, 10000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000006');
  perform koreman_test.check('commissie', 'overgedragen architect ná overdracht: 5% = 500',
    c.eligible and c.pct = 5 and c.commission = 500,
    format('pct %s, commissie %s', c.pct, c.commission));
end
$$;

-- ===========================================================================
-- 7. Uitgesloten architect en ingetrokken claim leveren niets op
-- ===========================================================================
update public.architects
set excluded_from_commission = true, exclusion_reason = 'Was al klant vóór het contract'
where id = '55555555-0000-0000-0000-000000000001';

select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000007',
  '55555555-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 10000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000007');
  perform koreman_test.check('commissie', 'uitgesloten architect: geen commissie',
    not c.eligible and c.ineligible_reason = 'architect_excluded',
    format('eligible %s, reden %s', c.eligible, c.ineligible_reason));
end
$$;

update public.architects
set excluded_from_commission = false, exclusion_reason = null
where id = '55555555-0000-0000-0000-000000000001';

-- ===========================================================================
-- 8. Subagent: hoofdagent krijgt 12,5% (1.250), subagent 9% (900)
-- ===========================================================================
select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000008',
  '77777777-0000-0000-0000-000000000003',
  '44444444-4444-4444-4444-444444444444',
  current_date, 10000, 10000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000008');

  perform koreman_test.check('commissie',
    'subagent: Koreman betaalt 1.250 aan de hoofdagent',
    c.commission = 1250 and c.payable_agent_id = '22222222-2222-2222-2222-222222222222',
    format('commissie %s aan %s', c.commission, c.payable_agent_id));

  perform koreman_test.check('commissie',
    'subagent: hoofdagent geeft 900 door (9%)',
    c.subagent_pct = 9 and c.subagent_amount = 900,
    format('pct %s, bedrag %s', c.subagent_pct, c.subagent_amount));
end
$$;

-- ===========================================================================
-- 9. Subagent mét korting: evenredig deel van de aftrek
--    korting 1.000, speling 0 -> aftrek 1.000
--    hoofdagent 1.250 - 1.000 = 250
--    subagent   900 - 1.000 * 9/12,5 = 900 - 720 = 180
-- ===========================================================================
select koreman_test.make_order(
  'b0000000-0000-0000-0000-000000000009',
  '77777777-0000-0000-0000-000000000003',
  '44444444-4444-4444-4444-444444444444',
  current_date, 10000, 9000);

do $$
declare c record;
begin
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000009');

  perform koreman_test.check('commissie', 'subagent met korting: hoofdagent 250',
    c.commission = 250, format('commissie %s', c.commission));
  perform koreman_test.check('commissie', 'subagent met korting: subagent 180 (evenredige aftrek)',
    c.subagent_amount = 180, format('bedrag %s', c.subagent_amount));
end
$$;

-- ===========================================================================
-- 10. Ledger: order op betaald zetten maakt de regels aan
-- ===========================================================================
set local role authenticated;
select koreman_test.login('11111111-1111-1111-1111-111111111111', 'aal2');

update public.orders set status = 'goedgekeurd'
where id = 'b0000000-0000-0000-0000-000000000008';
update public.orders set status = 'betaald'
where id = 'b0000000-0000-0000-0000-000000000008';

do $$
declare v_main numeric; v_sub numeric; v_count integer;
begin
  select count(*) into v_count from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008';

  select amount into v_main from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008'
    and kind = 'commission' and payable_by = 'koreman';

  select amount into v_sub from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008'
    and kind = 'subagent_share' and payable_by = 'parent_agent';

  perform koreman_test.check('commissie', 'betaald: twee ledgerregels aangemaakt', v_count = 2,
    format('%s regels', v_count));
  perform koreman_test.check('commissie', 'betaald: 1.250 door Koreman verschuldigd', v_main = 1250,
    format('bedrag %s', v_main));
  perform koreman_test.check('commissie', 'betaald: 900 door hoofdagent verschuldigd', v_sub = 900,
    format('bedrag %s', v_sub));
end
$$;

-- ===========================================================================
-- 11. Clawback bij retour na betaling, ook voor het deel van de subagent
-- ===========================================================================
update public.orders set status = 'retour'
where id = 'b0000000-0000-0000-0000-000000000008';

do $$
declare v_clawbacks integer; v_total numeric;
begin
  select count(*), coalesce(sum(amount), 0) into v_clawbacks, v_total
  from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008' and kind = 'clawback';

  perform koreman_test.check('commissie', 'retour: twee verrekeningen (ook voor de subagent)',
    v_clawbacks = 2, format('%s verrekeningen', v_clawbacks));
  perform koreman_test.check('commissie', 'retour: verrekening is -2.150', v_total = -2150,
    format('som %s', v_total));
end
$$;

do $$
declare v_net numeric;
begin
  select coalesce(sum(amount), 0) into v_net from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008';

  perform koreman_test.check('commissie', 'na verrekening staat het saldo op 0', v_net = 0,
    format('saldo %s', v_net));
end
$$;

select koreman_test.logout();
reset role;

-- Stopt met een exception zodra er iets faalt (handig in CI).
select koreman_test.report('commissie');

-- De Supabase SQL Editor toont geen NOTICE-regels, wel deze tabel.
select ok, label, detail
from koreman_test.results
where suite = 'commissie'
order by seq;

rollback;
