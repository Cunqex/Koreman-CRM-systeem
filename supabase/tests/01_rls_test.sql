-- RLS-tests. Draait in één transactie en eindigt met rollback.
--   psql "$DATABASE_URL" -f supabase/tests/00_helpers.sql -f supabase/tests/01_rls_test.sql
--
-- Draai dit als superuser/postgres: de fixtures worden buiten RLS om gezet,
-- de tests zelf draaien expliciet als rol 'authenticated'.

begin;

delete from koreman_test.results where suite = 'rls';

-- ---------------------------------------------------------------------------
-- Fixtures
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

insert into public.contracts (id, agent_id, start_date, own_commission_pct, transferred_commission_pct, subagent_own_pct)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', current_date - 100, 12.5, 5, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', current_date - 100, 12.5, 5, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', current_date - 100, 12.5, 5, 9);

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

-- Twee activiteiten bij de architect van agent1: één vers, één ouder dan 24 uur.
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

-- ===========================================================================
-- 1. Een agent ziet geen data van een andere agent
-- ===========================================================================
set local role authenticated;
select koreman_test.login('22222222-2222-2222-2222-222222222222');

do $$
declare v_own integer; v_other integer;
begin
  select count(*) into v_own from public.architects
  where id = '55555555-0000-0000-0000-000000000001';
  select count(*) into v_other from public.architects
  where id = '66666666-0000-0000-0000-000000000002';

  perform koreman_test.check('rls', 'agent ziet eigen architect', v_own = 1,
    format('verwacht 1, kreeg %s', v_own));
  perform koreman_test.check('rls', 'agent ziet architect van andere agent NIET', v_other = 0,
    format('verwacht 0, kreeg %s', v_other));
end
$$;

-- ===========================================================================
-- 2. Een hoofdagent ziet zijn subagent wel
-- ===========================================================================
do $$
declare v_sub integer;
begin
  select count(*) into v_sub from public.architects
  where id = '77777777-0000-0000-0000-000000000003';

  perform koreman_test.check('rls', 'hoofdagent ziet architect van subagent', v_sub = 1,
    format('verwacht 1, kreeg %s', v_sub));
end
$$;

-- ===========================================================================
-- 3. Een agent kan de architect van een ander niet wijzigen
-- ===========================================================================
do $$
declare v_rows integer;
begin
  update public.architects set city = 'Gekaapt'
  where id = '66666666-0000-0000-0000-000000000002';
  get diagnostics v_rows = row_count;

  perform koreman_test.check('rls', 'agent kan architect van ander niet wijzigen', v_rows = 0,
    format('%s rijen gewijzigd', v_rows));
exception when others then
  perform koreman_test.check('rls', 'agent kan architect van ander niet wijzigen', true, sqlerrm);
end
$$;

-- ===========================================================================
-- 4. Een agent kan geen activiteit verwijderen
-- ===========================================================================
do $$
declare v_rows integer; v_still integer;
begin
  delete from public.activities where id = '88888888-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  select count(*) into v_still from public.activities
  where id = '88888888-0000-0000-0000-000000000001';

  perform koreman_test.check('rls', 'agent kan activiteit niet verwijderen',
    v_rows = 0 and v_still = 1, format('%s verwijderd, %s over', v_rows, v_still));
exception when others then
  perform koreman_test.check('rls', 'agent kan activiteit niet verwijderen', true, sqlerrm);
end
$$;

-- ===========================================================================
-- 5. Binnen 24 uur wijzigen mag wel, daarna niet
-- ===========================================================================
do $$
declare v_rows integer;
begin
  update public.activities set subject = 'Bijgewerkt binnen 24 uur'
  where id = '88888888-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;

  perform koreman_test.check('rls', 'agent kan activiteit binnen 24 uur wijzigen', v_rows = 1,
    format('%s rijen gewijzigd', v_rows));
exception when others then
  perform koreman_test.check('rls', 'agent kan activiteit binnen 24 uur wijzigen', false, sqlerrm);
end
$$;

do $$
declare v_rows integer; v_subject text;
begin
  update public.activities set subject = 'Mag niet meer'
  where id = '88888888-0000-0000-0000-000000000002';
  get diagnostics v_rows = row_count;

  select subject into v_subject from public.activities
  where id = '88888888-0000-0000-0000-000000000002';

  perform koreman_test.check('rls', 'agent kan activiteit na 24 uur NIET wijzigen',
    v_rows = 0 and v_subject is distinct from 'Mag niet meer',
    format('%s rijen gewijzigd, onderwerp nu %s', v_rows, v_subject));
exception when others then
  -- De trigger mag het ook met een exception weigeren.
  perform koreman_test.check('rls', 'agent kan activiteit na 24 uur NIET wijzigen', true, sqlerrm);
end
$$;

-- ===========================================================================
-- 6. Een agent kan de orderstatus niet wijzigen
-- ===========================================================================
do $$
declare v_status public.order_status;
begin
  begin
    update public.orders set status = 'goedgekeurd'
    where id = '99999999-0000-0000-0000-000000000001';
  exception when others then
    null;
  end;

  select status into v_status from public.orders
  where id = '99999999-0000-0000-0000-000000000001';

  perform koreman_test.check('rls', 'agent kan orderstatus niet wijzigen',
    v_status = 'ingediend', format('status is nu %s', v_status));
end
$$;

-- ===========================================================================
-- 7. Een agent kan geen commissieregel aanmaken
-- ===========================================================================
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into public.commission_entries
      (agent_id, kind, payable_by, base_amount, amount)
    values
      ('22222222-2222-2222-2222-222222222222', 'commission', 'koreman', 10000, 1250);
  exception when others then
    v_blocked := true;
  end;

  perform koreman_test.check('rls', 'agent kan geen commission_entries maken', v_blocked,
    'insert werd niet geweigerd');
end
$$;

-- ===========================================================================
-- 8. Een agent kan last_activity_at niet zelf zetten
-- ===========================================================================
do $$
declare v_blocked boolean := false;
begin
  begin
    update public.architects set last_activity_at = now()
    where id = '55555555-0000-0000-0000-000000000001';
  exception when others then
    v_blocked := true;
  end;

  perform koreman_test.check('rls', 'agent kan last_activity_at niet zelf zetten', v_blocked,
    'kolom was toch schrijfbaar');
end
$$;

-- ===========================================================================
-- 9. Een subagent ziet niets van zijn hoofdagent
-- ===========================================================================
select koreman_test.login('44444444-4444-4444-4444-444444444444');

do $$
declare v_own integer; v_parent integer; v_parent_act integer;
begin
  select count(*) into v_own from public.architects
  where id = '77777777-0000-0000-0000-000000000003';
  select count(*) into v_parent from public.architects
  where id = '55555555-0000-0000-0000-000000000001';
  select count(*) into v_parent_act from public.activities
  where agent_id = '22222222-2222-2222-2222-222222222222';

  perform koreman_test.check('rls', 'subagent ziet eigen architect', v_own = 1,
    format('verwacht 1, kreeg %s', v_own));
  perform koreman_test.check('rls', 'subagent ziet architect van hoofdagent NIET', v_parent = 0,
    format('verwacht 0, kreeg %s', v_parent));
  perform koreman_test.check('rls', 'subagent ziet activiteiten van hoofdagent NIET',
    v_parent_act = 0, format('verwacht 0, kreeg %s', v_parent_act));
end
$$;

-- ===========================================================================
-- 10. Admin zonder aal2 krijgt geen admin-rechten; mét aal2 wel
-- ===========================================================================
select koreman_test.login('11111111-1111-1111-1111-111111111111', 'aal1');

do $$
declare v_is_admin boolean; v_seen integer; v_own_profile integer;
begin
  select public.is_admin() into v_is_admin;
  select count(*) into v_seen from public.architects;
  select count(*) into v_own_profile from public.profiles
  where id = '11111111-1111-1111-1111-111111111111';

  perform koreman_test.check('rls', 'admin zonder aal2 is geen admin', v_is_admin = false,
    'is_admin() gaf true zonder MFA');
  perform koreman_test.check('rls', 'admin zonder aal2 ziet geen architecten', v_seen = 0,
    format('verwacht 0, kreeg %s', v_seen));
  perform koreman_test.check('rls', 'admin zonder aal2 leest wel eigen profiel',
    v_own_profile = 1, format('verwacht 1, kreeg %s', v_own_profile));
end
$$;

select koreman_test.login('11111111-1111-1111-1111-111111111111', 'aal2');

do $$
declare v_is_admin boolean; v_seen integer; v_audit integer;
begin
  select public.is_admin() into v_is_admin;
  select count(*) into v_seen from public.architects;
  select count(*) into v_audit from public.audit_log;

  perform koreman_test.check('rls', 'admin met aal2 is admin', v_is_admin,
    'is_admin() gaf false mét MFA');
  perform koreman_test.check('rls', 'admin met aal2 ziet alle architecten', v_seen >= 3,
    format('verwacht >= 3, kreeg %s', v_seen));
  perform koreman_test.check('rls', 'admin leest de audit log', v_audit > 0,
    format('audit log bevat %s regels', v_audit));
end
$$;

-- ===========================================================================
-- 11. Ook een admin kan een activiteit niet verwijderen
-- ===========================================================================
do $$
declare v_rows integer; v_still integer;
begin
  delete from public.activities where id = '88888888-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  select count(*) into v_still from public.activities
  where id = '88888888-0000-0000-0000-000000000001';

  perform koreman_test.check('rls', 'ook Koreman kan een activiteit niet verwijderen',
    v_rows = 0 and v_still = 1, format('%s verwijderd', v_rows));
exception when others then
  perform koreman_test.check('rls', 'ook Koreman kan een activiteit niet verwijderen', true, sqlerrm);
end
$$;

-- ===========================================================================
-- 12. Een agent ziet de audit log niet
-- ===========================================================================
select koreman_test.login('22222222-2222-2222-2222-222222222222');

do $$
declare v_audit integer;
begin
  select count(*) into v_audit from public.audit_log;
  perform koreman_test.check('rls', 'agent ziet de audit log niet', v_audit = 0,
    format('verwacht 0, kreeg %s', v_audit));
end
$$;

select koreman_test.logout();
reset role;

-- Stopt met een exception zodra er iets faalt (handig in CI).
select koreman_test.report('rls');

-- De Supabase SQL Editor toont geen NOTICE-regels, wel deze tabel.
select ok, label, detail
from koreman_test.results
where suite = 'rls'
order by seq;

rollback;
