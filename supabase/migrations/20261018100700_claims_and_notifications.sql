-- Fase 2 — Claimbeslissingen en in-portaal meldingen.

-- ---------------------------------------------------------------------------
-- claim_actions: bewijs van elke beslissing over een claim of regio
-- ---------------------------------------------------------------------------
create table public.claim_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  architect_id uuid references public.architects (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete cascade,
  action public.claim_action_type not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  performed_by uuid references public.profiles (id) on delete set null,
  performed_at timestamptz not null default now(),
  new_agent_id uuid references public.profiles (id) on delete set null,
  constraint claim_actions_needs_subject check (
    architect_id is not null or contract_id is not null
  ),
  constraint claim_actions_reassign_needs_agent check (
    action <> 'reassign' or new_agent_id is not null
  )
);

create index claim_actions_architect_idx on public.claim_actions (architect_id, performed_at desc);
create index claim_actions_contract_idx on public.claim_actions (contract_id, performed_at desc);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
-- Voorkomt dat de dagelijkse job dezelfde melding blijft herhalen.
-- De cast naar UTC maakt de expressie immutable, wat een index vereist.
create unique index notifications_daily_unique
  on public.notifications (
    user_id,
    type,
    coalesce(link, ''),
    ((created_at at time zone 'UTC')::date)
  )
  where type in ('architect_inactive', 'follow_up_due', 'contract_year_end');

-- ---------------------------------------------------------------------------
-- Meldingshelpers (security definer: ze schrijven voor andere gebruikers)
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link)
  on conflict do nothing;
end;
$$;

create or replace function public.notify_admins(
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link
  from public.profiles p
  where p.role = 'admin' and p.is_active
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_user(uuid, public.notification_type, text, text, text) from public;
revoke all on function public.notify_admins(public.notification_type, text, text, text) from public;

-- ---------------------------------------------------------------------------
-- Meldingen rond architecten
-- ---------------------------------------------------------------------------
create or replace function public.fn_architects_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_agent text;
  v_link text;
  v_duplicates integer;
begin
  v_name := new.first_name || ' ' || new.last_name;
  v_link := '/architecten/' || new.id;
  select p.full_name into v_agent from public.profiles p where p.id = new.agent_id;

  if tg_op = 'INSERT' then
    perform public.notify_admins(
      'architect_created',
      'Nieuwe architect: ' || v_name,
      coalesce(v_agent, 'Onbekende agent') || ' heeft een architect aangemaakt.',
      v_link
    );

    if not new.in_region then
      perform public.notify_admins(
        'architect_out_of_region',
        'Architect buiten regio: ' || v_name,
        'Het kantooradres valt buiten de regio van ' || coalesce(v_agent, 'de agent') || '.',
        v_link
      );
    end if;

    select count(*) into v_duplicates
    from public.find_duplicate_architects(new.email, new.last_name, new.postcode) d
    where d.architect_id <> new.id;

    if v_duplicates > 0 then
      perform public.notify_admins(
        'architect_possible_duplicate',
        'Mogelijke duplicaat: ' || v_name,
        'Er bestaat al een architect met hetzelfde e-mailadres of dezelfde naam en postcode.',
        v_link
      );
    end if;

    return null;
  end if;

  -- Claimwijziging: de betrokken agent hoort dat te weten.
  if new.claim_status is distinct from old.claim_status then
    perform public.notify_user(
      new.agent_id,
      'claim_changed',
      'Claim gewijzigd: ' || v_name,
      'De claimstatus is nu: ' || new.claim_status || '.',
      v_link
    );
  end if;

  -- Overdracht aan een andere agent.
  if new.agent_id is distinct from old.agent_id then
    perform public.notify_user(
      old.agent_id,
      'claim_changed',
      'Architect overgedragen: ' || v_name,
      'Deze architect staat niet langer op jouw naam.',
      v_link
    );
    perform public.notify_user(
      new.agent_id,
      'claim_changed',
      'Architect toegewezen: ' || v_name,
      'Deze architect staat nu op jouw naam.',
      v_link
    );
  end if;

  if new.in_region = false and old.in_region = true then
    perform public.notify_admins(
      'architect_out_of_region',
      'Architect buiten regio: ' || v_name,
      'Het kantooradres valt na wijziging buiten de regio van ' || coalesce(v_agent, 'de agent') || '.',
      v_link
    );
  end if;

  return null;
end;
$$;

create trigger architects_notify
after insert or update on public.architects
for each row execute function public.fn_architects_notify();

-- ---------------------------------------------------------------------------
-- Meldingen rond orders
-- ---------------------------------------------------------------------------
create or replace function public.fn_orders_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text;
  v_ref text;
  v_agent text;
begin
  v_link := '/orders/' || new.id;
  v_ref := coalesce(nullif(new.reference, ''), left(new.id::text, 8));

  if tg_op = 'INSERT' then
    select p.full_name into v_agent from public.profiles p where p.id = new.agent_id;
    perform public.notify_admins(
      'order_submitted',
      'Nieuwe order ingediend: ' || v_ref,
      coalesce(v_agent, 'Een agent') || ' heeft een order ingediend ter goedkeuring.',
      v_link
    );
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'goedgekeurd' then
      perform public.notify_user(new.agent_id, 'order_approved',
        'Order goedgekeurd: ' || v_ref, null, v_link);
    elsif new.status = 'afgekeurd' then
      perform public.notify_user(new.agent_id, 'order_rejected',
        'Order afgekeurd: ' || v_ref, new.rejection_reason, v_link);
    elsif new.status = 'betaald' then
      perform public.notify_user(new.agent_id, 'order_paid',
        'Order betaald: ' || v_ref, 'De commissie is toegekend.', v_link);
    end if;
  end if;

  return null;
end;
$$;

create trigger orders_notify
after insert or update on public.orders
for each row execute function public.fn_orders_notify();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.claim_actions enable row level security;
alter table public.notifications enable row level security;

create policy claim_actions_select on public.claim_actions
for select to authenticated
using (
  public.is_admin()
  or (architect_id is not null and public.can_see_architect(architect_id))
  or (contract_id is not null and exists (
        select 1 from public.contracts c
        where c.id = claim_actions.contract_id
          and c.agent_id in (select public.visible_agent_ids())
      ))
);

create policy claim_actions_insert_admin on public.claim_actions
for insert to authenticated
with check (public.is_admin() and performed_by = auth.uid());

-- Geen update of delete: claimbeslissingen zijn bewijs.

create policy notifications_select_own on public.notifications
for select to authenticated
using (user_id = auth.uid());

-- Alleen gelezen-markeren mag; de inhoud ligt vast.
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
for delete to authenticated
using (user_id = auth.uid());
