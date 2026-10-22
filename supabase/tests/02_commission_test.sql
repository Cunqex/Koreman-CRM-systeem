-- Commissietests: de formule en de ledger.
--
-- Draaien: plak dit hele bestand in de Supabase SQL Editor en klik Run.
-- Je krijgt onderaan een tabel met per test ok / test / detail.
--
-- Zelfstandig bestand: geen 00_helpers.sql nodig en geen hulptabel, zodat
-- RLS nergens in de weg kan zitten. Alles draait in één transactie die
-- eindigt met rollback.
--
-- Uitgangspunt in alle scenario's: adviesprijs 10.000 excl. btw, eigen
-- percentage 12,5%, overgedragen 5%, doorgeefpercentage subagent 9%.

begin;

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

insert into public.architects (id, agent_id, first_name, last_name, postcode, origin) values
  ('55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Anna', 'Jansen', '6211 AB', 'agent_signed'),
  ('77777777-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444',
   'Carla', 'Peters', '6411 AB', 'agent_signed');

insert into public.architects
  (id, agent_id, first_name, last_name, postcode, origin, transferred_at)
values
  ('55555555-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'Bram', 'Overdracht', '6212 AB', 'koreman_transferred', current_date - 30);

-- Elke order krijgt één regel; adviesprijs en verkoopprijs zijn regeltotalen.
create or replace function pg_temp.mk_order(
  p_id uuid, p_architect uuid, p_agent uuid, p_date date,
  p_advice numeric, p_sale numeric
) returns void language plpgsql as $mk$
begin
  insert into public.orders (id, architect_id, agent_id, order_date, reference, status)
  values (p_id, p_architect, p_agent, p_date, 'T-' || left(p_id::text, 4), 'ingediend');
  insert into public.order_lines
    (order_id, design_name, quantity, advice_price, sale_price)
  values (p_id, 'Teststuk', 1, p_advice, p_sale);
end
$mk$;

select pg_temp.mk_order('b0000000-0000-0000-0000-000000000001',
  '55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 10000);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000002',
  '55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 9000);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000003',
  '55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 9600);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000004',
  '55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 9000);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000005',
  '55555555-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
  current_date - 60, 10000, 10000);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000006',
  '55555555-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
  current_date - 10, 10000, 10000);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000007',
  '55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
  current_date, 10000, 10000);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000008',
  '77777777-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444',
  current_date, 10000, 10000);
select pg_temp.mk_order('b0000000-0000-0000-0000-000000000009',
  '77777777-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444',
  current_date, 10000, 9000);

-- ---------------------------------------------------------------------------
-- De tests
-- ---------------------------------------------------------------------------
create or replace function pg_temp.run_commission_tests()
returns table (ok boolean, test text, detail text)
language plpgsql
as $fn$
declare
  c record;
  v_count integer;
  v_main numeric;
  v_sub numeric;
  v_total numeric;
begin
  -- De guard-triggers op architects en orders vragen om een admin met aal2.
  -- In de SQL Editor zit daar geen JWT achter, dus zetten we die claims hier.
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}', true);

  --------------------------------------------------- 1. geen korting
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000001');
  ok := c.eligible and c.commission = 1250 and c.discount_deduction = 0;
  test := 'zonder korting: 12,5% van 10.000 = 1.250';
  detail := format('commissie %s, aftrek %s', c.commission, c.discount_deduction);
  return next;

  --------------------------------------------------- 2. korting, speling 0
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000002');
  ok := c.commission = 250 and c.discount = 1000 and c.discount_deduction = 1000;
  test := 'korting 1.000 zonder speling: 250';
  detail := format('commissie %s, korting %s, aftrek %s',
                   c.commission, c.discount, c.discount_deduction);
  return next;

  --------------------------------------------------- 3. korting binnen speling
  update public.contracts set price_tolerance_pct = 5
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000003');
  ok := c.commission = 1250 and c.discount_deduction = 0 and c.tolerance = 500;
  test := 'korting 400 binnen speling 500: volle 1.250';
  detail := format('commissie %s, speling %s, aftrek %s',
                   c.commission, c.tolerance, c.discount_deduction);
  return next;

  --------------------------------------------------- 4. korting boven speling
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000004');
  ok := c.commission = 750 and c.discount_deduction = 500;
  test := 'korting 1.000 boven speling 500: 750';
  detail := format('commissie %s, aftrek %s', c.commission, c.discount_deduction);
  return next;

  update public.contracts set price_tolerance_pct = 0
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  --------------------------------------------------- 5. vóór de overdracht
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000005');
  ok := not c.eligible and c.ineligible_reason = 'order_before_transfer';
  test := 'overgedragen architect vóór overdracht: geen commissie';
  detail := format('eligible %s, reden %s', c.eligible, c.ineligible_reason);
  return next;

  --------------------------------------------------- 6. ná de overdracht
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000006');
  ok := c.eligible and c.pct = 5 and c.commission = 500;
  test := 'overgedragen architect ná overdracht: 5% = 500';
  detail := format('pct %s, commissie %s', c.pct, c.commission);
  return next;

  --------------------------------------------------- 7. uitgesloten architect
  update public.architects
  set excluded_from_commission = true,
      exclusion_reason = 'Was al klant vóór het contract'
  where id = '55555555-0000-0000-0000-000000000001';

  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000007');
  ok := not c.eligible and c.ineligible_reason = 'architect_excluded';
  test := 'uitgesloten architect: geen commissie';
  detail := format('eligible %s, reden %s', c.eligible, c.ineligible_reason);
  return next;

  update public.architects
  set excluded_from_commission = false, exclusion_reason = null
  where id = '55555555-0000-0000-0000-000000000001';

  --------------------------------------------------- 8. subagent, geen korting
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000008');
  ok := c.commission = 1250
        and c.payable_agent_id = '22222222-2222-2222-2222-222222222222';
  test := 'subagent: Koreman betaalt 1.250 aan de hoofdagent';
  detail := format('commissie %s aan %s', c.commission, c.payable_agent_id);
  return next;

  ok := c.subagent_pct = 9 and c.subagent_amount = 900;
  test := 'subagent: hoofdagent geeft 900 door (9%)';
  detail := format('pct %s, bedrag %s', c.subagent_pct, c.subagent_amount);
  return next;

  --------------------------------------------------- 9. subagent mét korting
  -- korting 1.000, speling 0 -> aftrek 1.000
  -- hoofdagent 1.250 - 1.000 = 250
  -- subagent   900 - 1.000 * 9/12,5 = 900 - 720 = 180
  select * into c from public.calculate_commission('b0000000-0000-0000-0000-000000000009');
  ok := c.commission = 250;
  test := 'subagent met korting: hoofdagent 250';
  detail := format('commissie %s', c.commission);
  return next;

  ok := c.subagent_amount = 180;
  test := 'subagent met korting: subagent 180 (evenredige aftrek)';
  detail := format('bedrag %s', c.subagent_amount);
  return next;

  --------------------------------------------------- 10. ledger bij betaald
  update public.orders set status = 'goedgekeurd'
  where id = 'b0000000-0000-0000-0000-000000000008';
  update public.orders set status = 'betaald'
  where id = 'b0000000-0000-0000-0000-000000000008';

  select count(*) into v_count from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008';

  select amount into v_main from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008'
    and kind = 'commission' and payable_by = 'koreman';

  select amount into v_sub from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008'
    and kind = 'subagent_share' and payable_by = 'parent_agent';

  ok := v_count = 2;
  test := 'betaald: twee ledgerregels aangemaakt';
  detail := format('%s regels', v_count);
  return next;

  ok := v_main = 1250;
  test := 'betaald: 1.250 door Koreman verschuldigd';
  detail := format('bedrag %s', coalesce(v_main::text, 'geen regel'));
  return next;

  ok := v_sub = 900;
  test := 'betaald: 900 door hoofdagent verschuldigd';
  detail := format('bedrag %s', coalesce(v_sub::text, 'geen regel'));
  return next;

  --------------------------------------------------- 11. clawback bij retour
  update public.orders set status = 'retour'
  where id = 'b0000000-0000-0000-0000-000000000008';

  select count(*), coalesce(sum(amount), 0) into v_count, v_total
  from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008' and kind = 'clawback';

  ok := v_count = 2;
  test := 'retour: twee verrekeningen (ook voor de subagent)';
  detail := format('%s verrekeningen', v_count);
  return next;

  ok := v_total = -2150;
  test := 'retour: verrekening is -2.150';
  detail := format('som %s', v_total);
  return next;

  select coalesce(sum(amount), 0) into v_total from public.commission_entries
  where order_id = 'b0000000-0000-0000-0000-000000000008';
  ok := v_total = 0;
  test := 'na verrekening staat het saldo op 0';
  detail := format('saldo %s', v_total);
  return next;

  perform set_config('request.jwt.claims', '', true);
  return;
end
$fn$;

select * from pg_temp.run_commission_tests();

rollback;
