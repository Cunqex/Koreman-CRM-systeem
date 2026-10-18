-- Fase 2 — Contracten, regio's, postcodes en targets.

-- ---------------------------------------------------------------------------
-- postcode_provinces: seed-tabel met NL-postcodereeksen (4 cijfers)
-- ---------------------------------------------------------------------------
create table public.postcode_provinces (
  postcode_from smallint not null check (postcode_from between 1000 and 9999),
  postcode_to smallint not null check (postcode_to between 1000 and 9999),
  province public.province not null,
  primary key (postcode_from, postcode_to),
  constraint postcode_provinces_range check (postcode_to >= postcode_from)
);

create index postcode_provinces_range_idx
  on public.postcode_provinces (postcode_from, postcode_to);

-- ---------------------------------------------------------------------------
-- contracts
-- ---------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default extensions.gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date,
  contract_file_path text,

  -- Commissie over architecten die de agent zelf heeft getekend.
  own_commission_pct numeric(5, 2) not null default 12.5
    check (own_commission_pct >= 0 and own_commission_pct <= 100),
  -- Commissie over architecten die Koreman heeft overgedragen.
  transferred_commission_pct numeric(5, 2) not null default 5
    check (transferred_commission_pct >= 0 and transferred_commission_pct <= 100),

  -- Alleen op contracten van subagenten: het deel dat de hoofdagent doorgeeft.
  subagent_own_pct numeric(5, 2)
    check (subagent_own_pct is null or (subagent_own_pct >= 0 and subagent_own_pct <= 100)),
  subagent_transferred_pct numeric(5, 2)
    check (subagent_transferred_pct is null or (subagent_transferred_pct >= 0 and subagent_transferred_pct <= 100)),

  inactivity_days integer not null default 60 check (inactivity_days > 0),
  -- Speling onder de adviesprijs voordat korting van de commissie afgaat.
  price_tolerance_pct numeric(5, 2) not null default 0
    check (price_tolerance_pct >= 0 and price_tolerance_pct <= 100),
  clawback_enabled boolean not null default true,
  region_claim_active boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  constraint contracts_period check (end_date is null or end_date >= start_date)
);

-- Eén lopend contract per agent; afgesloten contracten blijven als historie staan.
create unique index contracts_one_open_per_agent
  on public.contracts (agent_id)
  where end_date is null;

create index contracts_agent_idx on public.contracts (agent_id);
create index contracts_period_idx on public.contracts (agent_id, start_date, end_date);

create trigger contracts_set_updated_at
before update on public.contracts
for each row execute function public.set_updated_at();

create trigger contracts_audit
after insert or update on public.contracts
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- contract_regions
-- ---------------------------------------------------------------------------
create table public.contract_regions (
  id uuid primary key default extensions.gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  province public.province not null,
  created_at timestamptz not null default now(),
  unique (contract_id, province)
);

create index contract_regions_contract_idx on public.contract_regions (contract_id);

create trigger contract_regions_audit
after insert or update on public.contract_regions
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- contract_postcode_exceptions
-- ---------------------------------------------------------------------------
create table public.contract_postcode_exceptions (
  id uuid primary key default extensions.gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  postcode_from smallint not null check (postcode_from between 1000 and 9999),
  postcode_to smallint not null check (postcode_to between 1000 and 9999),
  kind public.postcode_exception_kind not null,
  note text,
  created_at timestamptz not null default now(),
  constraint contract_postcode_exceptions_range check (postcode_to >= postcode_from)
);

create index contract_postcode_exceptions_contract_idx
  on public.contract_postcode_exceptions (contract_id);

create trigger contract_postcode_exceptions_audit
after insert or update on public.contract_postcode_exceptions
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- contract_targets
-- ---------------------------------------------------------------------------
create table public.contract_targets (
  id uuid primary key default extensions.gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  label text not null,
  scope public.target_scope not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index contract_targets_contract_idx on public.contract_targets (contract_id);

create trigger contract_targets_audit
after insert or update on public.contract_targets
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- Regio-helpers
-- ---------------------------------------------------------------------------

-- Haalt de 4 cijfers uit een postcode ('6211 AB', '6211ab', '6211') en zoekt
-- de provincie op. Geeft null bij een onbekende of ongeldige postcode.
--
-- Reeksen mogen overlappen: de SMALSTE reeks wint. Zo kan een brede
-- standaardreeks (bijvoorbeeld 5300-5399 Noord-Brabant) met een smalle rij
-- worden gecorrigeerd (5300-5305 Zaltbommel is Gelderland), zonder de
-- bestaande seed te hoeven herschrijven.
create or replace function public.province_for_postcode(p_postcode text)
returns public.province
language sql
stable
security definer
set search_path = public
as $$
  select pp.province
  from public.postcode_provinces pp
  where nullif(regexp_replace(coalesce(p_postcode, ''), '\D', '', 'g'), '') is not null
    and left(regexp_replace(p_postcode, '\D', '', 'g'), 4)::smallint
        between pp.postcode_from and pp.postcode_to
  order by (pp.postcode_to - pp.postcode_from) asc
  limit 1;
$$;

-- Het contract van een agent dat op een bepaalde datum liep.
create or replace function public.contract_for_agent_on(
  p_agent_id uuid,
  p_on date
)
returns public.contracts
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from public.contracts c
  where c.agent_id = p_agent_id
    and c.start_date <= p_on
    and (c.end_date is null or c.end_date >= p_on)
  order by c.start_date desc
  limit 1;
$$;

-- Valt een postcode binnen de regio van een agent?
--
-- Regio = gekozen provincies + extra opgenomen postcodereeksen
--         - uitgesloten postcodereeksen. Een uitsluiting wint altijd.
--
-- Zonder lopend contract, of met een ingetrokken regioclaim, is er geen
-- regio om buiten te vallen; dan geldt alles als "binnen regio", zodat de
-- UI geen loze waarschuwingen toont.
create or replace function public.architect_in_region(
  p_agent_id uuid,
  p_postcode text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_contract public.contracts;
  v_digits smallint;
  v_province public.province;
begin
  v_contract := public.contract_for_agent_on(p_agent_id, current_date);

  if v_contract.id is null or not v_contract.region_claim_active then
    return true;
  end if;

  v_digits := nullif(left(regexp_replace(coalesce(p_postcode, ''), '\D', '', 'g'), 4), '')::smallint;

  if v_digits is null then
    -- Geen bruikbare postcode: niet markeren als buiten regio.
    return true;
  end if;

  if exists (
    select 1 from public.contract_postcode_exceptions e
    where e.contract_id = v_contract.id
      and e.kind = 'exclude'
      and v_digits between e.postcode_from and e.postcode_to
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.contract_postcode_exceptions e
    where e.contract_id = v_contract.id
      and e.kind = 'include'
      and v_digits between e.postcode_from and e.postcode_to
  ) then
    return true;
  end if;

  v_province := public.province_for_postcode(p_postcode);
  if v_province is null then
    return true;
  end if;

  return exists (
    select 1 from public.contract_regions r
    where r.contract_id = v_contract.id
      and r.province = v_province
  );
end;
$$;

revoke all on function public.province_for_postcode(text) from public;
revoke all on function public.contract_for_agent_on(uuid, date) from public;
revoke all on function public.architect_in_region(uuid, text) from public;
grant execute on function public.province_for_postcode(text) to authenticated;
grant execute on function public.contract_for_agent_on(uuid, date) to authenticated;
grant execute on function public.architect_in_region(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.postcode_provinces enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_regions enable row level security;
alter table public.contract_postcode_exceptions enable row level security;
alter table public.contract_targets enable row level security;

-- Referentietabel: leesbaar voor iedereen die is ingelogd, alleen Koreman beheert.
create policy postcode_provinces_select on public.postcode_provinces
for select to authenticated using (true);

create policy postcode_provinces_write_admin on public.postcode_provinces
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Een agent leest zijn eigen contract en dat van zijn subagenten; schrijven
-- doet alleen Koreman.
create policy contracts_select on public.contracts
for select to authenticated
using (agent_id in (select public.visible_agent_ids()));

create policy contracts_write_admin on public.contracts
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy contract_regions_select on public.contract_regions
for select to authenticated
using (
  exists (
    select 1 from public.contracts c
    where c.id = contract_regions.contract_id
      and c.agent_id in (select public.visible_agent_ids())
  )
);

create policy contract_regions_write_admin on public.contract_regions
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy contract_postcode_exceptions_select on public.contract_postcode_exceptions
for select to authenticated
using (
  exists (
    select 1 from public.contracts c
    where c.id = contract_postcode_exceptions.contract_id
      and c.agent_id in (select public.visible_agent_ids())
  )
);

create policy contract_postcode_exceptions_write_admin on public.contract_postcode_exceptions
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy contract_targets_select on public.contract_targets
for select to authenticated
using (
  exists (
    select 1 from public.contracts c
    where c.id = contract_targets.contract_id
      and c.agent_id in (select public.visible_agent_ids())
  )
);

create policy contract_targets_write_admin on public.contract_targets
for all to authenticated
using (public.is_admin()) with check (public.is_admin());
