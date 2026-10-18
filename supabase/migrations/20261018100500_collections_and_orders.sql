-- Fase 2 — Collecties, orders en orderregels.
--
-- De agent registreert de order. Alleen Koreman verandert de status, en dat
-- wordt in de database afgedwongen, niet in de frontend.

-- ---------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  description text,
  is_exclusive boolean not null default false,
  exclusive_architect_id uuid references public.architects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint collections_exclusive_needs_architect check (
    not is_exclusive or exclusive_architect_id is not null
  ),
  constraint collections_architect_only_when_exclusive check (
    is_exclusive or exclusive_architect_id is null
  )
);

create index collections_exclusive_architect_idx
  on public.collections (exclusive_architect_id);

create trigger collections_set_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

create trigger collections_audit
after insert or update on public.collections
for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  architect_id uuid not null references public.architects (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  agent_id uuid not null references public.profiles (id) on delete restrict,

  order_date date not null,
  reference text,
  status public.order_status not null default 'ingediend',

  -- Apart vastgelegd; tellen NIET mee voor commissie of target.
  shipping_cost numeric(12, 2) not null default 0 check (shipping_cost >= 0),
  installation_cost numeric(12, 2) not null default 0 check (installation_cost >= 0),

  agent_notes text,
  admin_notes text,
  rejection_reason text,

  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  constraint orders_rejection_needs_reason check (
    status <> 'afgekeurd' or nullif(btrim(coalesce(rejection_reason, '')), '') is not null
  )
);

create index orders_architect_idx on public.orders (architect_id, order_date desc);
create index orders_agent_idx on public.orders (agent_id, order_date desc);
create index orders_status_idx on public.orders (status);
create index orders_project_idx on public.orders (project_id);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger orders_audit
after insert or update on public.orders
for each row execute function public.fn_audit();

-- documents.order_id kon pas nu een echte foreign key worden.
alter table public.documents
  add constraint documents_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- order_lines
-- ---------------------------------------------------------------------------
create table public.order_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete restrict,
  design_name text,
  width_cm numeric(8, 1) check (width_cm is null or width_cm > 0),
  length_cm numeric(8, 1) check (length_cm is null or length_cm > 0),
  shape public.order_line_shape,
  -- Kleuraanpassingen, materiaal, afwerking enzovoort.
  custom_edits text,
  quantity integer not null default 1 check (quantity > 0),

  -- Beide bedragen zijn regeltotalen, excl. btw.
  advice_price numeric(12, 2) not null default 0 check (advice_price >= 0),
  sale_price numeric(12, 2) not null default 0 check (sale_price >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_lines_order_idx on public.order_lines (order_id);
create index order_lines_collection_idx on public.order_lines (collection_id);

create trigger order_lines_set_updated_at
before update on public.order_lines
for each row execute function public.set_updated_at();

create trigger order_lines_audit
after insert or update on public.order_lines
for each row execute function public.fn_audit();

-- Een exclusieve collectie is alleen te kiezen voor de architect waaraan ze
-- is gekoppeld.
create or replace function public.fn_order_lines_check_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection public.collections;
  v_architect_id uuid;
begin
  if new.collection_id is null then
    return new;
  end if;

  select * into v_collection from public.collections c where c.id = new.collection_id;

  if not v_collection.is_exclusive then
    return new;
  end if;

  select o.architect_id into v_architect_id
  from public.orders o where o.id = new.order_id;

  if v_architect_id is distinct from v_collection.exclusive_architect_id then
    raise exception 'Collectie % is exclusief en kan niet voor deze architect worden gekozen.',
      v_collection.name
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger order_lines_check_collection
before insert or update of collection_id, order_id on public.order_lines
for each row execute function public.fn_order_lines_check_collection();

-- ---------------------------------------------------------------------------
-- Statusovergangen: alleen Koreman, en alleen volgens dit schema
-- ---------------------------------------------------------------------------
create or replace function public.fn_orders_status_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  if new.status is distinct from old.status then
    if not public.is_admin() then
      raise exception 'Alleen Koreman kan de status van een order wijzigen.'
        using errcode = '42501';
    end if;

    v_allowed := case old.status
      when 'ingediend'   then new.status in ('goedgekeurd', 'afgekeurd', 'geannuleerd')
      when 'afgekeurd'   then new.status in ('ingediend', 'geannuleerd')
      when 'goedgekeurd' then new.status in ('betaald', 'afgekeurd', 'geannuleerd')
      when 'betaald'     then new.status in ('retour', 'geannuleerd')
      else false
    end;

    if not v_allowed then
      raise exception 'Statusovergang van % naar % is niet toegestaan.', old.status, new.status
        using errcode = '23514';
    end if;

    -- Stempels horen bij de overgang, niet bij wat de client meestuurt.
    if new.status = 'goedgekeurd' then
      new.approved_by := auth.uid();
      new.approved_at := now();
    elsif new.status = 'betaald' then
      new.paid_at := coalesce(new.paid_at, now());
    elsif new.status in ('geannuleerd', 'retour') then
      new.cancelled_at := now();
    end if;

    return new;
  end if;

  -- Geen statuswijziging: dan mag een agent alleen bewerken zolang de order
  -- is ingediend, en nooit de administratieve velden aanraken.
  if not public.is_admin() then
    if old.status <> 'ingediend' then
      raise exception 'Een order kan alleen worden aangepast zolang die is ingediend.'
        using errcode = '42501';
    end if;

    if new.agent_id is distinct from old.agent_id
       or new.admin_notes is distinct from old.admin_notes
       or new.rejection_reason is distinct from old.rejection_reason
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.paid_at is distinct from old.paid_at
       or new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'Deze velden kunnen alleen door Koreman worden gewijzigd.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_status_guard
before update on public.orders
for each row execute function public.fn_orders_status_guard();

-- Een nieuwe order start altijd als 'ingediend' wanneer een agent hem maakt.
create or replace function public.fn_orders_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and new.status <> 'ingediend' then
    raise exception 'Een nieuwe order wordt altijd als ingediend vastgelegd.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger orders_insert_guard
before insert on public.orders
for each row execute function public.fn_orders_insert_guard();

-- Orderregels volgen hetzelfde slot als de order zelf.
create or replace function public.fn_order_lines_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
  v_order_id uuid;
begin
  v_order_id := coalesce(new.order_id, old.order_id);
  select o.status into v_status from public.orders o where o.id = v_order_id;

  if not public.is_admin() and v_status <> 'ingediend' then
    raise exception 'Orderregels kunnen alleen worden aangepast zolang de order is ingediend.'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger order_lines_locked
before insert or update or delete on public.order_lines
for each row execute function public.fn_order_lines_locked();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.collections enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

-- Iedereen die is ingelogd ziet de collecties; alleen Koreman beheert ze.
create policy collections_select on public.collections
for select to authenticated using (true);

create policy collections_write_admin on public.collections
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy orders_select on public.orders
for select to authenticated
using (public.is_admin() or agent_id in (select public.visible_agent_ids()));

create policy orders_insert_own on public.orders
for insert to authenticated
with check (
  agent_id = auth.uid()
  and public.can_edit_architect(architect_id)
);

create policy orders_insert_admin on public.orders
for insert to authenticated
with check (public.is_admin());

create policy orders_update_own on public.orders
for update to authenticated
using (agent_id = auth.uid() and status = 'ingediend')
with check (agent_id = auth.uid());

create policy orders_update_admin on public.orders
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy orders_delete_admin on public.orders
for delete to authenticated
using (public.is_admin());

create policy order_lines_select on public.order_lines
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_lines.order_id
      and (public.is_admin() or o.agent_id in (select public.visible_agent_ids()))
  )
);

create policy order_lines_write_own on public.order_lines
for all to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_lines.order_id
      and o.agent_id = auth.uid()
      and o.status = 'ingediend'
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_lines.order_id
      and o.agent_id = auth.uid()
      and o.status = 'ingediend'
  )
);

create policy order_lines_write_admin on public.order_lines
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Documenten die alleen aan een order hangen
--
-- documents is eerder aangemaakt, toen orders nog niet bestond; de
-- order-tak van de zichtbaarheid kon daar dus nog niet in.
-- ---------------------------------------------------------------------------
create policy documents_select_via_order on public.documents
for select to authenticated
using (
  order_id is not null
  and exists (
    select 1 from public.orders o
    where o.id = documents.order_id
      and (public.is_admin() or o.agent_id in (select public.visible_agent_ids()))
  )
);

create policy documents_insert_via_order on public.documents
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and order_id is not null
  and exists (
    select 1 from public.orders o
    where o.id = documents.order_id
      and (public.is_admin() or o.agent_id = auth.uid())
  )
);
