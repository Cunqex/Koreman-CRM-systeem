-- Fase 2 — Profielen, autorisatie-helpers, audit log.
--
-- Autorisatie-model: de anon key staat publiek in de frontend, dus elke regel
-- wordt in de database afgedwongen. Frontend-checks zijn alleen cosmetisch.

-- ---------------------------------------------------------------------------
-- Gedeelde trigger: updated_at bijhouden
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  parent_agent_id uuid references public.profiles (id) on delete set null,
  language text not null default 'nl' check (language in ('nl', 'en')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  -- Alleen een subagent hangt onder een hoofdagent.
  constraint profiles_parent_only_for_subagent check (
    (role = 'subagent' and parent_agent_id is not null)
    or (role <> 'subagent' and parent_agent_id is null)
  ),
  constraint profiles_no_self_parent check (parent_agent_id is distinct from id)
);

create index profiles_parent_agent_id_idx on public.profiles (parent_agent_id);
create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Autorisatie-helpers (security definer, stable)
-- ---------------------------------------------------------------------------

-- De rol van de ingelogde gebruiker. Heet bewust niet current_role(): dat is
-- een gereserveerd SQL-sleutelwoord in Postgres.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Is de aanroeper een actieve admin MET tweestapsverificatie?
--
-- De aal2-eis zit opzettelijk IN deze functie en niet in elke policy apart:
-- zo kan geen enkele admin-policy de MFA-eis per ongeluk overslaan. Een admin
-- die nog geen aal2 heeft, kan via de policy "eigen profiel" nog wel zijn
-- eigen profiel lezen, zodat de frontend hem naar de MFA-stap kan sturen.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active
  )
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Admin zonder de MFA-eis. Alleen bedoeld voor checks die niets ontsluiten,
-- zoals "mag deze gebruiker zijn eigen rol niet wijzigen".
create or replace function public.is_admin_without_mfa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active
  );
$$;

-- Van welke agenten mag de aanroeper data zien?
--   admin     -> alle profielen
--   agent     -> zichzelf + zijn subagenten
--   subagent  -> alleen zichzelf
create or replace function public.visible_agent_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if public.is_admin() then
    return query select p.id from public.profiles p;
    return;
  end if;

  select p.role into v_role from public.profiles p
  where p.id = auth.uid() and p.is_active;

  if v_role is null then
    return;
  end if;

  if v_role = 'agent' then
    return query
      select p.id from public.profiles p
      where p.id = auth.uid() or p.parent_agent_id = auth.uid();
  else
    return query select auth.uid();
  end if;
end;
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin_without_mfa() from public;
revoke all on function public.visible_agent_ids() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_without_mfa() to authenticated;
grant execute on function public.visible_agent_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action public.audit_action not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index audit_log_table_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_user_idx on public.audit_log (user_id);

-- Generieke audit-trigger. Draait als security definer zodat de insert niet
-- door de RLS-policies van audit_log heen hoeft.
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid;
begin
  begin
    if tg_op = 'DELETE' then
      v_record_id := (to_jsonb(old) ->> 'id')::uuid;
    else
      v_record_id := (to_jsonb(new) ->> 'id')::uuid;
    end if;
  exception when others then
    v_record_id := null;
  end;

  insert into public.audit_log (
    table_name, record_id, action, old_data, new_data, user_id
  )
  values (
    tg_table_name,
    v_record_id,
    case when tg_op = 'INSERT' then 'insert'::public.audit_action
         else 'update'::public.audit_action end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    auth.uid()
  );

  return new;
end;
$$;

create trigger profiles_audit
after insert or update on public.profiles
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- Een gebruiker mag zijn eigen rol, hoofdagent of actief-vlag niet wijzigen.
-- ---------------------------------------------------------------------------
create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_without_mfa() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.parent_agent_id is distinct from old.parent_agent_id
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email then
    raise exception 'Rol, hoofdagent, e-mailadres en actief-status kunnen alleen door Koreman worden gewijzigd.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard
before update on public.profiles
for each row execute function public.fn_profiles_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

-- Eigen profiel: altijd leesbaar, ook voor een admin zonder aal2. Zonder deze
-- policy kan de frontend niet vaststellen dat iemand admin is en dus ook niet
-- naar de MFA-stap sturen.
create policy profiles_select_self on public.profiles
for select to authenticated
using (id = auth.uid());

create policy profiles_select_visible on public.profiles
for select to authenticated
using (id in (select public.visible_agent_ids()));

-- Namen van Koreman-medewerkers zijn leesbaar, zodat "uitgevoerd door" en
-- "goedgekeurd door" in de UI een naam kunnen tonen in plaats van een uuid.
create policy profiles_select_admins on public.profiles
for select to authenticated
using (role = 'admin');

create policy profiles_select_admin_all on public.profiles
for select to authenticated
using (public.is_admin());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy profiles_insert_admin on public.profiles
for insert to authenticated
with check (public.is_admin());

-- Geen delete-policy: profielen worden gedeactiveerd, niet verwijderd.

-- Audit log: alleen admin leest. Niemand schrijft, wijzigt of verwijdert via
-- de API; alleen de security-definer triggerfunctie vult de tabel.
create policy audit_log_select_admin on public.audit_log
for select to authenticated
using (public.is_admin());
