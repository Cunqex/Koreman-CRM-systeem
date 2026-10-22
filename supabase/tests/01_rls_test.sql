-- RLS-tests.
--
-- Draaien: plak dit hele bestand in de Supabase SQL Editor en klik Run.
-- Je krijgt onderaan een tabel met per test ok / test / detail.
--
-- Dit bestand is zelfstandig: het heeft 00_helpers.sql niet nodig en schrijft
-- nergens naar een tabel. Alle uitkomsten worden in geheugen verzameld en in
-- één keer teruggegeven, juist omdat een hulptabel zelf weer onder RLS valt.
--
-- Alles draait in één transactie die eindigt met rollback, dus er blijft
-- niets van achter in je database.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (als eigenaar, vóór het rolwisselen)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@koreman.test'),
  ('22222222-2222-2222-2222-222222222222', 'agent1@koreman.test'),
  ('33333333-3333-3333-3333-333333333333', 'agent2@koreman.test'),
  ('44444444-4444-4444-4444-444444444444', 'sub1@koreman.test')
on conflict (id) do nothing;

insert into public.profiles (id, role, full_name, email, parent_agent_id) values
  ('11111111-1111-1111-1111-111111111111', 'admin',    'Koreman Beheer', 'admin@koreman.test',  null),
  ('22222222-2222-2222-2222-222222222222', 'agent',    'Agent Een',      'agent1@koreman.test', null),
  ('33333333-3333-3333-3333-333333333333', 'agent',    'Agent Twee',     'agent2@koreman.test', null),
  ('44444444-4444-4444-4444-444444444444', 'subagent', 'Subagent Een',   'sub1@koreman.test',
   '22222222-2222-2222-2222-222222222222');

insert into public.contracts (id, agent_id, start_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', current_date - 100),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', current_date - 100),
  ('aaaaaaaa-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', current_date - 100);

insert into public.contract_regions (contract_id, province) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Limburg'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Noord-Holland'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Limburg');

insert into public.architects (id, agent_id, first_name, last_name, postcode, city) values
  ('55555555-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Anna',  'Jansen',   '6211 AB', 'Maastricht'),
  ('66666666-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
   'Bram',  'de Vries', '1011 AB', 'Amsterdam'),
  ('77777777-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444',
   'Carla', 'Peters',   '6411 AB', 'Heerlen');

insert into public.activities (id, architect_id, agent_id, type, activity_date, subject) values
  ('88888888-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'bezoek', current_date, 'Verse activiteit'),
  ('88888888-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'telefoon', current_date - 3, 'Oude activiteit');

-- created_at terugzetten kan alleen met de bewaartrigger even uit.
alter table public.activities disable trigger activities_edit_window;
update public.activities
set created_at = now() - interval '48 hours'
where id = '88888888-0000-0000-0000-000000000002';
alter table public.activities enable trigger activities_edit_window;

insert into public.orders (id, architect_id, agent_id, order_date, reference, status) values
  ('99999999-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', current_date, 'TEST-001', 'ingediend');

insert into public.order_lines (order_id, design_name, quantity, advice_price, sale_price) values
  ('99999999-0000-0000-0000-000000000001', 'Strata 200x300', 1, 10000, 10000);

-- ---------------------------------------------------------------------------
-- De tests zelf
--
-- Alles in één functie, die de rol per onderdeel zelf wisselt en de uitslag
-- als resultaatset teruggeeft. Zo is er geen hulptabel nodig.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.run_rls_tests()
returns table (ok boolean, test text, detail text)
language plpgsql
as $fn$
declare
  v_a integer;
  v_b integer;
  v_c integer;
  v_rows integer;
  v_text text;
  v_status public.order_status;
  v_flag boolean;
begin
  ------------------------------------------------------------------ agent 1
  perform set_config('request.jwt.claims',
    '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}', true);
  execute 'set local role authenticated';

  select count(*) into v_a from public.architects
  where id = '55555555-0000-0000-0000-000000000001';
  ok := v_a = 1;
  test := 'agent ziet eigen architect';
  detail := format('verwacht 1, kreeg %s', v_a);
  return next;

  select count(*) into v_b from public.architects
  where id = '66666666-0000-0000-0000-000000000002';
  ok := v_b = 0;
  test := 'agent ziet architect van andere agent NIET';
  detail := format('verwacht 0, kreeg %s', v_b);
  return next;

  select count(*) into v_c from public.architects
  where id = '77777777-0000-0000-0000-000000000003';
  ok := v_c = 1;
  test := 'hoofdagent ziet architect van subagent';
  detail := format('verwacht 1, kreeg %s', v_c);
  return next;

  -- Architect van een ander wijzigen: RLS laat dit 0 rijen raken.
  begin
    update public.architects set city = 'Gekaapt'
    where id = '66666666-0000-0000-0000-000000000002';
    get diagnostics v_rows = row_count;
    ok := v_rows = 0;
    detail := format('%s rijen gewijzigd', v_rows);
  exception when others then
    ok := true;
    detail := sqlerrm;
  end;
  test := 'agent kan architect van ander niet wijzigen';
  return next;

  -- Activiteiten zijn bewijsvoering: er is voor niemand een DELETE-policy.
  begin
    delete from public.activities where id = '88888888-0000-0000-0000-000000000001';
    get diagnostics v_rows = row_count;
    select count(*) into v_a from public.activities
    where id = '88888888-0000-0000-0000-000000000001';
    ok := v_rows = 0 and v_a = 1;
    detail := format('%s verwijderd, %s over', v_rows, v_a);
  exception when others then
    ok := true;
    detail := sqlerrm;
  end;
  test := 'agent kan activiteit niet verwijderen';
  return next;

  -- Binnen 24 uur mag wijzigen wel.
  begin
    update public.activities set subject = 'Bijgewerkt binnen 24 uur'
    where id = '88888888-0000-0000-0000-000000000001';
    get diagnostics v_rows = row_count;
    ok := v_rows = 1;
    detail := format('%s rijen gewijzigd', v_rows);
  exception when others then
    ok := false;
    detail := sqlerrm;
  end;
  test := 'agent kan activiteit binnen 24 uur wijzigen';
  return next;

  -- Daarna niet meer.
  begin
    update public.activities set subject = 'Mag niet meer'
    where id = '88888888-0000-0000-0000-000000000002';
    get diagnostics v_rows = row_count;
    select subject into v_text from public.activities
    where id = '88888888-0000-0000-0000-000000000002';
    ok := v_rows = 0 and v_text is distinct from 'Mag niet meer';
    detail := format('%s rijen gewijzigd, onderwerp %s', v_rows, coalesce(v_text, 'onzichtbaar'));
  exception when others then
    ok := true;
    detail := sqlerrm;
  end;
  test := 'agent kan activiteit na 24 uur NIET wijzigen';
  return next;

  -- Statusovergangen zijn voorbehouden aan Koreman.
  begin
    update public.orders set status = 'goedgekeurd'
    where id = '99999999-0000-0000-0000-000000000001';
  exception when others then
    null;
  end;
  select status into v_status from public.orders
  where id = '99999999-0000-0000-0000-000000000001';
  ok := v_status = 'ingediend';
  test := 'agent kan orderstatus niet wijzigen';
  detail := format('status is nu %s', coalesce(v_status::text, 'onzichtbaar'));
  return next;

  -- De commissieledger wordt alleen door triggers gevuld.
  v_flag := false;
  begin
    insert into public.commission_entries
      (agent_id, kind, payable_by, base_amount, amount)
    values
      ('22222222-2222-2222-2222-222222222222', 'commission', 'koreman', 10000, 1250);
  exception when others then
    v_flag := true;
  end;
  ok := v_flag;
  test := 'agent kan geen commission_entries maken';
  detail := case when v_flag then 'geweigerd' else 'insert werd NIET geweigerd' end;
  return next;

  -- last_activity_at is kolomrechtelijk afgeschermd, zodat activiteit niet
  -- te faken is.
  v_flag := false;
  begin
    update public.architects set last_activity_at = now()
    where id = '55555555-0000-0000-0000-000000000001';
  exception when others then
    v_flag := true;
  end;
  ok := v_flag;
  test := 'agent kan last_activity_at niet zelf zetten';
  detail := case when v_flag then 'geweigerd' else 'kolom was toch schrijfbaar' end;
  return next;

  -- De audit log is alleen voor Koreman.
  select count(*) into v_a from public.audit_log;
  ok := v_a = 0;
  test := 'agent ziet de audit log niet';
  detail := format('verwacht 0, kreeg %s', v_a);
  return next;

  ----------------------------------------------------------------- subagent
  perform set_config('request.jwt.claims',
    '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","aal":"aal1"}', true);

  select count(*) into v_a from public.architects
  where id = '77777777-0000-0000-0000-000000000003';
  ok := v_a = 1;
  test := 'subagent ziet eigen architect';
  detail := format('verwacht 1, kreeg %s', v_a);
  return next;

  select count(*) into v_b from public.architects
  where id = '55555555-0000-0000-0000-000000000001';
  ok := v_b = 0;
  test := 'subagent ziet architect van hoofdagent NIET';
  detail := format('verwacht 0, kreeg %s', v_b);
  return next;

  select count(*) into v_c from public.activities
  where agent_id = '22222222-2222-2222-2222-222222222222';
  ok := v_c = 0;
  test := 'subagent ziet activiteiten van hoofdagent NIET';
  detail := format('verwacht 0, kreeg %s', v_c);
  return next;

  ------------------------------------------------------- admin zonder aal2
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}', true);

  select public.is_admin() into v_flag;
  ok := v_flag = false;
  test := 'admin zonder aal2 is geen admin';
  detail := format('is_admin() gaf %s', v_flag);
  return next;

  select count(*) into v_a from public.architects;
  ok := v_a = 0;
  test := 'admin zonder aal2 ziet geen architecten';
  detail := format('verwacht 0, kreeg %s', v_a);
  return next;

  select count(*) into v_b from public.profiles
  where id = '11111111-1111-1111-1111-111111111111';
  ok := v_b = 1;
  test := 'admin zonder aal2 leest wel eigen profiel';
  detail := format('verwacht 1, kreeg %s', v_b);
  return next;

  ---------------------------------------------------------- admin met aal2
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}', true);

  select public.is_admin() into v_flag;
  ok := v_flag;
  test := 'admin met aal2 is admin';
  detail := format('is_admin() gaf %s', v_flag);
  return next;

  select count(*) into v_a from public.architects;
  ok := v_a >= 3;
  test := 'admin met aal2 ziet alle architecten';
  detail := format('verwacht >= 3, kreeg %s', v_a);
  return next;

  select count(*) into v_b from public.audit_log;
  ok := v_b > 0;
  test := 'admin leest de audit log';
  detail := format('audit log bevat %s regels', v_b);
  return next;

  -- Ook Koreman kan bewijsvoering niet weggooien.
  begin
    delete from public.activities where id = '88888888-0000-0000-0000-000000000001';
    get diagnostics v_rows = row_count;
    select count(*) into v_a from public.activities
    where id = '88888888-0000-0000-0000-000000000001';
    ok := v_rows = 0 and v_a = 1;
    detail := format('%s verwijderd, %s over', v_rows, v_a);
  exception when others then
    ok := true;
    detail := sqlerrm;
  end;
  test := 'ook Koreman kan een activiteit niet verwijderen';
  return next;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return;
end
$fn$;

select * from pg_temp.run_rls_tests();

rollback;
