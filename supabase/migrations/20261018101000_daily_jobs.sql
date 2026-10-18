-- Fase 2 — Dagelijkse meldingen via pg_cron.
--
-- Inactieve architecten, vervallen follow-ups en het einde van een
-- contractjaar leveren geen trigger op; die worden één keer per dag berekend.

create extension if not exists pg_cron with schema extensions;

-- Architecten die hun inactiviteitsgrens passeren -> melding aan Koreman.
create or replace function public.notify_inactive_architects()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      a.id,
      a.first_name,
      a.last_name,
      a.agent_id,
      coalesce(c.inactivity_days, 60) as inactivity_days,
      a.last_activity_at
    from public.architects a
    left join lateral (
      select * from public.contract_for_agent_on(a.agent_id, current_date)
    ) c on true
    where a.status <> 'inactief'
      and a.claim_status = 'agent'
      and (
        a.last_activity_at is null
        or a.last_activity_at < now() - make_interval(days => coalesce(c.inactivity_days, 60))
      )
  loop
    perform public.notify_admins(
      'architect_inactive',
      format('%s dagen zonder activiteit: %s %s',
             r.inactivity_days, r.first_name, r.last_name),
      'Er is geen activiteit meer vastgelegd binnen de afgesproken termijn.',
      '/architecten/' || r.id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Follow-ups die vandaag of eerder vervallen -> melding aan de agent.
create or replace function public.notify_due_follow_ups()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      ac.id,
      ac.agent_id,
      ac.architect_id,
      ac.subject,
      ac.follow_up_date,
      a.first_name,
      a.last_name
    from public.activities ac
    join public.architects a on a.id = ac.architect_id
    where ac.follow_up_done = false
      and ac.follow_up_date is not null
      and ac.follow_up_date <= current_date
  loop
    perform public.notify_user(
      r.agent_id,
      'follow_up_due',
      format('Opvolging open: %s %s', r.first_name, r.last_name),
      coalesce(r.subject, '') ||
        format(' (opvolgen op %s)', to_char(r.follow_up_date, 'DD-MM-YYYY')),
      '/architecten/' || r.architect_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Einde contractjaar -> melding aan Koreman om te evalueren.
create or replace function public.notify_contract_year_end()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      c.id,
      c.agent_id,
      p.full_name,
      public.contract_year_for(c.start_date, current_date - 1) as closing_year
    from public.contracts c
    join public.profiles p on p.id = c.agent_id
    where (c.end_date is null or c.end_date >= current_date)
      -- De dag na een contractverjaardag is het vorige contractjaar rond.
      and extract(month from c.start_date) = extract(month from current_date)
      and extract(day from c.start_date) = extract(day from current_date)
      and current_date > c.start_date
  loop
    perform public.notify_admins(
      'contract_year_end',
      format('Contractjaar %s afgerond: %s', r.closing_year, r.full_name),
      'Het contractjaar is voorbij. De targets kunnen worden geëvalueerd.',
      '/agenten/' || r.agent_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.run_daily_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_inactive_architects();
  perform public.notify_due_follow_ups();
  perform public.notify_contract_year_end();
end;
$$;

revoke all on function public.notify_inactive_architects() from public;
revoke all on function public.notify_due_follow_ups() from public;
revoke all on function public.notify_contract_year_end() from public;
revoke all on function public.run_daily_notifications() from public;

-- Elke ochtend om 06:00 UTC.
select cron.schedule(
  'koreman-daily-notifications',
  '0 6 * * *',
  $cron$ select public.run_daily_notifications(); $cron$
);
