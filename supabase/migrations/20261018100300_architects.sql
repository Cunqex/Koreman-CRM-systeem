-- Fase 2 — Architecten, afspraken, projecten en documenten.
-- De klant is de individuele architect, niet het bureau.

create table public.architects (
  id uuid primary key default extensions.gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete restrict,

  first_name text not null,
  last_name text not null,
  company_name text,
  email text,
  phone text,
  website text,

  street text,
  postcode text,
  city text,
  province public.province,

  origin public.architect_origin not null default 'agent_signed',
  transferred_at date,

  excluded_from_commission boolean not null default false,
  exclusion_reason text,

  status public.architect_status not null default 'actief',
  claim_status public.claim_status not null default 'agent',

  -- Berekend bij opslaan op basis van het kantooradres van de architect.
  in_region boolean not null default true,
  region_override boolean not null default false,

  last_activity_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  constraint architects_transferred_needs_date check (
    origin <> 'koreman_transferred' or transferred_at is not null
  ),
  constraint architects_exclusion_needs_reason check (
    not excluded_from_commission or nullif(btrim(coalesce(exclusion_reason, '')), '') is not null
  )
);

create index architects_agent_idx on public.architects (agent_id);
create index architects_status_idx on public.architects (status);
create index architects_last_activity_idx on public.architects (last_activity_at);
create index architects_email_idx on public.architects (lower(email));
create index architects_name_postcode_idx
  on public.architects (lower(last_name), left(coalesce(postcode, ''), 4));

create trigger architects_set_updated_at
before update on public.architects
for each row execute function public.set_updated_at();

create trigger architects_audit
after insert or update on public.architects
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- Provincie afleiden en regio bepalen bij elke opslag
-- ---------------------------------------------------------------------------
create or replace function public.fn_architects_derive_region()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_derived public.province;
begin
  v_derived := public.province_for_postcode(new.postcode);

  -- Koreman mag de provincie handmatig overschrijven; voor iedereen anders
  -- wordt die altijd uit de postcode afgeleid.
  if public.is_admin() and new.province is not null then
    null;
  else
    new.province := coalesce(v_derived, new.province);
  end if;

  -- region_override betekent: Koreman heeft besloten dat deze architect
  -- binnen de regio van de agent valt, ongeacht het adres.
  if new.region_override then
    new.in_region := true;
  else
    new.in_region := public.architect_in_region(new.agent_id, new.postcode);
  end if;

  return new;
end;
$$;

create trigger architects_derive_region
before insert or update of postcode, province, agent_id, region_override
on public.architects
for each row execute function public.fn_architects_derive_region();

-- ---------------------------------------------------------------------------
-- Velden die alleen Koreman mag zetten
-- ---------------------------------------------------------------------------
create or replace function public.fn_architects_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.agent_id is distinct from old.agent_id
     or new.origin is distinct from old.origin
     or new.transferred_at is distinct from old.transferred_at
     or new.excluded_from_commission is distinct from old.excluded_from_commission
     or new.exclusion_reason is distinct from old.exclusion_reason
     or new.claim_status is distinct from old.claim_status
     or new.region_override is distinct from old.region_override then
    raise exception 'Herkomst, claim, commissie-uitsluiting en regio-overschrijving kunnen alleen door Koreman worden gewijzigd.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger architects_guard
before update on public.architects
for each row execute function public.fn_architects_guard();

-- last_activity_at en in_region worden uitsluitend door triggers gezet.
--
-- Dit kan niet via de guard-trigger hierboven: de trigger op activities werkt
-- last_activity_at bij namens de agent, en die zou dan zijn eigen update
-- blokkeren. Een rechtenbeperking op kolomniveau is bovendien sterker — een
-- client kan deze twee kolommen simpelweg niet meesturen, en kan dus ook geen
-- recente activiteit faken om een inactiviteitsmelding te ontlopen.
revoke update on public.architects from authenticated;
grant update (
  first_name, last_name, company_name, email, phone, website,
  street, postcode, city, province,
  status, notes,
  agent_id, origin, transferred_at,
  excluded_from_commission, exclusion_reason,
  claim_status, region_override
) on public.architects to authenticated;

-- ---------------------------------------------------------------------------
-- Duplicaatcheck over alle agenten heen
--
-- Geeft bewust alleen een id en de reden terug. Een agent kan de gevonden
-- architect niet lezen (RLS), ziet dus alleen "bestaat mogelijk al"; Koreman
-- kan de rij wel ophalen en de daadwerkelijke match tonen.
-- ---------------------------------------------------------------------------
create or replace function public.find_duplicate_architects(
  p_email text default null,
  p_last_name text default null,
  p_postcode text default null
)
returns table (architect_id uuid, match_reason text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, 'email'
  from public.architects a
  where nullif(btrim(coalesce(p_email, '')), '') is not null
    and lower(a.email) = lower(btrim(p_email))
  union
  select a.id, 'name_postcode'
  from public.architects a
  where nullif(btrim(coalesce(p_last_name, '')), '') is not null
    and nullif(btrim(coalesce(p_postcode, '')), '') is not null
    and lower(a.last_name) = lower(btrim(p_last_name))
    and left(regexp_replace(coalesce(a.postcode, ''), '\D', '', 'g'), 4)
        = left(regexp_replace(p_postcode, '\D', '', 'g'), 4);
$$;

revoke all on function public.find_duplicate_architects(text, text, text) from public;
grant execute on function public.find_duplicate_architects(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- architect_agreements (één op één met de architect)
-- ---------------------------------------------------------------------------
create table public.architect_agreements (
  id uuid primary key default extensions.gen_random_uuid(),
  architect_id uuid not null unique references public.architects (id) on delete cascade,
  trade_discount_pct numeric(5, 2)
    check (trade_discount_pct is null or (trade_discount_pct >= 0 and trade_discount_pct <= 100)),
  payment_terms text,
  lead_time_agreement text,
  samples_arrangement text,
  delivery_agreement text,
  exclusive_collection_agreed boolean not null default false,
  other_agreements text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create trigger architect_agreements_set_updated_at
before update on public.architect_agreements
for each row execute function public.set_updated_at();

-- Historie van afspraken loopt via de audit log.
create trigger architect_agreements_audit
after insert or update on public.architect_agreements
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  architect_id uuid not null references public.architects (id) on delete cascade,
  name text not null,
  city text,
  status public.project_status not null default 'lopend',
  -- Optioneel: de agent bepaalt zelf of hij eindklantgegevens vastlegt.
  end_client_name text,
  end_client_email text,
  end_client_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create index projects_architect_idx on public.projects (architect_id);
create index projects_status_idx on public.projects (status);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger projects_audit
after insert or update on public.projects
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- documents (metadata; de bestanden staan in de private Storage-bucket)
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  architect_id uuid references public.architects (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  order_id uuid,
  file_path text not null unique,
  file_name text not null,
  mime_type text,
  size bigint check (size is null or size <= 20971520),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint documents_needs_owner check (
    architect_id is not null or project_id is not null or order_id is not null
  )
);

create index documents_architect_idx on public.documents (architect_id);
create index documents_project_idx on public.documents (project_id);
create index documents_order_idx on public.documents (order_id);

-- ---------------------------------------------------------------------------
-- Zichtbaarheidshelper: mag de aanroeper deze architect zien?
-- ---------------------------------------------------------------------------
create or replace function public.can_see_architect(p_architect_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.architects a
    where a.id = p_architect_id
      and (public.is_admin() or a.agent_id in (select public.visible_agent_ids()))
  );
$$;

-- Mag de aanroeper deze architect bewerken? Alleen de eigen agent of Koreman;
-- een hoofdagent kijkt bij zijn subagenten alleen mee.
create or replace function public.can_edit_architect(p_architect_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.architects a
    where a.id = p_architect_id
      and (public.is_admin() or a.agent_id = auth.uid())
  );
$$;

revoke all on function public.can_see_architect(uuid) from public;
revoke all on function public.can_edit_architect(uuid) from public;
grant execute on function public.can_see_architect(uuid) to authenticated;
grant execute on function public.can_edit_architect(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.architects enable row level security;
alter table public.architect_agreements enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;

create policy architects_select on public.architects
for select to authenticated
using (public.is_admin() or agent_id in (select public.visible_agent_ids()));

-- Een agent maakt architecten direct actief aan, zonder goedkeuring, maar
-- alleen op zijn eigen naam.
create policy architects_insert_own on public.architects
for insert to authenticated
with check (
  agent_id = auth.uid()
  and public.current_user_role() in ('agent', 'subagent')
);

create policy architects_insert_admin on public.architects
for insert to authenticated
with check (public.is_admin());

create policy architects_update_own on public.architects
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy architects_update_admin on public.architects
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy architects_delete_admin on public.architects
for delete to authenticated
using (public.is_admin());

create policy architect_agreements_select on public.architect_agreements
for select to authenticated
using (public.can_see_architect(architect_id));

create policy architect_agreements_write on public.architect_agreements
for all to authenticated
using (public.can_edit_architect(architect_id))
with check (public.can_edit_architect(architect_id));

create policy projects_select on public.projects
for select to authenticated
using (public.can_see_architect(architect_id));

create policy projects_write on public.projects
for all to authenticated
using (public.can_edit_architect(architect_id))
with check (public.can_edit_architect(architect_id));

create policy documents_select on public.documents
for select to authenticated
using (
  (architect_id is not null and public.can_see_architect(architect_id))
  or (project_id is not null and exists (
        select 1 from public.projects p
        where p.id = documents.project_id
          and public.can_see_architect(p.architect_id)
      ))
);

create policy documents_insert on public.documents
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    (architect_id is not null and public.can_edit_architect(architect_id))
    or (project_id is not null and exists (
          select 1 from public.projects p
          where p.id = documents.project_id
            and public.can_edit_architect(p.architect_id)
        ))
  )
);

create policy documents_delete_admin on public.documents
for delete to authenticated
using (public.is_admin());
