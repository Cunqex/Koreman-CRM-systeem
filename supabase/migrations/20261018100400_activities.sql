-- Fase 2 — Activiteiten: het bewijs van inzet.
--
-- Twee harde regels uit het contract:
--   1. Een activiteit is nooit verwijderbaar (geen enkele DELETE-policy).
--   2. Een agent kan alleen binnen 24 uur na aanmaken wijzigen; Koreman altijd.
-- Elke wijziging komt met oude en nieuwe waarde in de audit log.

create table public.activities (
  id uuid primary key default extensions.gen_random_uuid(),
  architect_id uuid not null references public.architects (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  agent_id uuid not null references public.profiles (id) on delete restrict,

  type public.activity_type not null,
  activity_date date not null,
  subject text not null,
  notes text,

  follow_up_date date,
  follow_up_note text,
  follow_up_done boolean not null default false,

  -- Gevuld zodra iemand de activiteit heeft aangepast; de UI toont dan
  -- het label "bewerkt" met de historie uit de audit log.
  edited_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  constraint activities_not_in_future check (activity_date <= current_date)
);

create index activities_architect_idx on public.activities (architect_id, activity_date desc);
create index activities_agent_idx on public.activities (agent_id, activity_date desc);
create index activities_follow_up_idx
  on public.activities (follow_up_date)
  where follow_up_done = false and follow_up_date is not null;
create index activities_created_at_idx on public.activities (created_at desc);

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

create trigger activities_audit
after insert or update on public.activities
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- De 24-uursregel
-- ---------------------------------------------------------------------------
create or replace function public.fn_activities_edit_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    new.edited_at := now();
    return new;
  end if;

  if now() - old.created_at > interval '24 hours' then
    raise exception 'Een activiteit kan alleen binnen 24 uur na het aanmaken worden gewijzigd.'
      using errcode = '42501';
  end if;

  -- De vastlegging zelf blijft van wie hem maakte.
  if new.agent_id is distinct from old.agent_id
     or new.architect_id is distinct from old.architect_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Agent, architect en aanmaakmoment van een activiteit liggen vast.'
      using errcode = '42501';
  end if;

  new.edited_at := now();
  return new;
end;
$$;

create trigger activities_edit_window
before update on public.activities
for each row execute function public.fn_activities_edit_window();

-- ---------------------------------------------------------------------------
-- last_activity_at op de architect bijhouden
-- ---------------------------------------------------------------------------
create or replace function public.fn_activities_touch_architect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.architects a
  set last_activity_at = greatest(
    coalesce(a.last_activity_at, 'epoch'::timestamptz),
    new.activity_date::timestamptz
  )
  where a.id = new.architect_id;

  return null;
end;
$$;

create trigger activities_touch_architect
after insert or update of activity_date, architect_id on public.activities
for each row execute function public.fn_activities_touch_architect();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.activities enable row level security;

create policy activities_select on public.activities
for select to authenticated
using (public.is_admin() or agent_id in (select public.visible_agent_ids()));

create policy activities_insert_own on public.activities
for insert to authenticated
with check (
  agent_id = auth.uid()
  and public.can_edit_architect(architect_id)
);

create policy activities_insert_admin on public.activities
for insert to authenticated
with check (public.is_admin());

-- De 24-uursgrens staat ook in de policy, zodat een rij die te oud is al bij
-- het ophalen van de update wordt geweigerd en niet pas in de trigger.
create policy activities_update_own on public.activities
for update to authenticated
using (agent_id = auth.uid() and now() - created_at <= interval '24 hours')
with check (agent_id = auth.uid());

create policy activities_update_admin on public.activities
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Bewust geen DELETE-policy, voor niemand: activiteiten zijn bewijsvoering.
