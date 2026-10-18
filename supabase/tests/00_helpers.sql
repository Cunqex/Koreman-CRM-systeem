-- Testhulpmiddelen. Wordt door de andere testbestanden als eerste geladen.
--
-- Draaien:
--   supabase db reset            (migraties + seed)
--   psql "$DATABASE_URL" -f supabase/tests/00_helpers.sql \
--                        -f supabase/tests/01_rls_test.sql
--
-- Elk testbestand draait in één transactie en eindigt met rollback, dus er
-- blijft niets achter in de database.

create schema if not exists koreman_test;

create table if not exists koreman_test.results (
  seq serial primary key,
  suite text not null,
  label text not null,
  ok boolean not null,
  detail text
);

-- Legt één uitkomst vast in plaats van de transactie af te breken, zodat één
-- fout niet de rest van de suite verbergt.
create or replace function koreman_test.check(
  p_suite text,
  p_label text,
  p_ok boolean,
  p_detail text default null
)
returns void
language plpgsql
as $$
begin
  insert into koreman_test.results (suite, label, ok, detail)
  values (p_suite, p_label, coalesce(p_ok, false), p_detail);
end;
$$;

-- Doet alsof de opgegeven gebruiker is ingelogd: zet de JWT-claims die
-- auth.uid() en auth.jwt() in Supabase lezen.
create or replace function koreman_test.login(
  p_user uuid,
  p_aal text default 'aal1'
)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
end;
$$;

create or replace function koreman_test.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Rapport aan het eind van een suite. Faalt de suite, dan stopt dit met een
-- exception zodat een CI-stap rood wordt.
create or replace function koreman_test.report(p_suite text)
returns void
language plpgsql
as $$
declare
  r record;
  v_failed integer;
  v_total integer;
begin
  for r in
    select label, ok, detail from koreman_test.results
    where suite = p_suite order by seq
  loop
    if r.ok then
      raise notice 'ok    %', r.label;
    else
      raise notice 'FAIL  %  %', r.label, coalesce('-> ' || r.detail, '');
    end if;
  end loop;

  select count(*) filter (where not ok), count(*)
  into v_failed, v_total
  from koreman_test.results where suite = p_suite;

  raise notice '--- % : % van % geslaagd', p_suite, v_total - v_failed, v_total;

  if v_failed > 0 then
    raise exception '% test(s) gefaald in suite %', v_failed, p_suite;
  end if;
end;
$$;
