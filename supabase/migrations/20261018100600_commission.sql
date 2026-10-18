-- Fase 2 — Commissieledger en de berekening.
--
-- De hele formule staat in één functie, calculate_commission(order_id), zodat
-- ze later op één plek aan te passen is. De ledger wordt alleen door triggers
-- gevuld; agenten kunnen er niets in schrijven.

create table public.commission_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  architect_id uuid references public.architects (id) on delete set null,

  kind public.commission_kind not null,
  payable_by public.commission_payable_by not null,

  base_amount numeric(12, 2) not null default 0,
  pct numeric(5, 2),
  discount_deduction numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null,

  contract_id uuid references public.contracts (id) on delete set null,
  contract_year integer,
  note text,

  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  constraint commission_entries_correction_needs_note check (
    kind <> 'correction' or nullif(btrim(coalesce(note, '')), '') is not null
  )
);

create index commission_entries_agent_idx on public.commission_entries (agent_id, created_at desc);
create index commission_entries_order_idx on public.commission_entries (order_id);
create index commission_entries_architect_idx on public.commission_entries (architect_id);
create index commission_entries_year_idx on public.commission_entries (agent_id, contract_year);

-- ---------------------------------------------------------------------------
-- Hulpfunctie: in welk contractjaar valt een datum?
-- Contractjaar 1 loopt vanaf start_date tot en met de dag voor de eerste
-- verjaardag van het contract.
-- ---------------------------------------------------------------------------
create or replace function public.contract_year_for(p_start_date date, p_on date)
returns integer
language sql
immutable
as $$
  select case
    when p_start_date is null or p_on is null or p_on < p_start_date then null
    else extract(year from age(p_on, p_start_date))::int + 1
  end;
$$;

-- ---------------------------------------------------------------------------
-- calculate_commission
--
-- Formule (alle bedragen excl. btw):
--   advice_total        = som van advice_price over de orderregels
--   sale_total          = som van sale_price
--   discount            = max(0, advice_total - sale_total)
--   tolerance           = advice_total * price_tolerance_pct / 100
--   discount_deduction  = max(0, discount - tolerance)
--   commission          = max(0, advice_total * pct / 100 - discount_deduction)
--
-- Subagenten: Koreman betaalt de volledige commissie aan de HOOFDAGENT,
-- berekend met de percentages uit het contract van de hoofdagent. Wat de
-- hoofdagent doorgeeft staat in het contract van de subagent
-- (subagent_own_pct / subagent_transferred_pct) en wordt hier alleen ter
-- informatie vastgelegd. Het evenredige deel van de kortingsaftrek is
-- discount_deduction * subagent_pct / pct.
-- ---------------------------------------------------------------------------
create or replace function public.calculate_commission(p_order_id uuid)
returns table (
  eligible boolean,
  ineligible_reason text,
  advice_total numeric,
  sale_total numeric,
  discount numeric,
  tolerance numeric,
  discount_deduction numeric,
  pct numeric,
  commission numeric,
  contract_id uuid,
  contract_year integer,
  payable_agent_id uuid,
  subagent_agent_id uuid,
  subagent_pct numeric,
  subagent_amount numeric,
  subagent_contract_id uuid,
  subagent_contract_year integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_architect public.architects;
  v_agent public.profiles;
  v_payable_agent_id uuid;
  v_contract public.contracts;
  v_sub_contract public.contracts;
  v_advice numeric(12, 2);
  v_sale numeric(12, 2);
  v_discount numeric(12, 2);
  v_tolerance numeric(12, 2);
  v_deduction numeric(12, 2);
  v_pct numeric(5, 2);
  v_commission numeric(12, 2);
  v_sub_pct numeric(5, 2);
  v_sub_amount numeric(12, 2);
  v_reason text;
begin
  select * into v_order from public.orders o where o.id = p_order_id;
  if v_order.id is null then
    return;
  end if;

  select * into v_architect from public.architects a where a.id = v_order.architect_id;
  select * into v_agent from public.profiles p where p.id = v_order.agent_id;

  -- Koreman betaalt de commissie uit aan de hoofdagent; een subagent wordt
  -- door zijn hoofdagent betaald.
  v_payable_agent_id := coalesce(v_agent.parent_agent_id, v_agent.id);

  select sum(l.advice_price), sum(l.sale_price)
  into v_advice, v_sale
  from public.order_lines l
  where l.order_id = p_order_id;

  v_advice := coalesce(v_advice, 0);
  v_sale := coalesce(v_sale, 0);
  v_discount := greatest(0, v_advice - v_sale);

  -- Het contract dat de commissie bepaalt: dat van de hoofdagent.
  v_contract := public.contract_for_agent_on(v_payable_agent_id, v_order.order_date);
  -- Het eigen contract van de subagent, voor de doorgeefpercentages.
  if v_agent.parent_agent_id is not null then
    v_sub_contract := public.contract_for_agent_on(v_agent.id, v_order.order_date);
  end if;

  -- --- Uitsluitingsgronden -------------------------------------------------
  if v_architect.excluded_from_commission then
    v_reason := 'architect_excluded';
  elsif v_architect.claim_status <> 'agent' then
    v_reason := 'claim_not_with_agent';
  elsif v_contract.id is null then
    v_reason := 'no_contract';
  elsif v_architect.origin = 'koreman_transferred'
        and (v_architect.transferred_at is null
             or v_order.order_date < v_architect.transferred_at) then
    -- Overgedragen architect: alleen omzet ná de overdracht telt mee.
    v_reason := 'order_before_transfer';
  end if;

  if v_reason is not null then
    return query select
      false, v_reason,
      v_advice, v_sale, v_discount,
      0::numeric, 0::numeric, 0::numeric, 0::numeric,
      v_contract.id,
      public.contract_year_for(v_contract.start_date, v_order.order_date),
      v_payable_agent_id,
      case when v_agent.parent_agent_id is not null then v_agent.id end,
      null::numeric, null::numeric,
      v_sub_contract.id,
      public.contract_year_for(v_sub_contract.start_date, v_order.order_date);
    return;
  end if;

  -- --- Percentage ----------------------------------------------------------
  v_pct := case
    when v_architect.origin = 'agent_signed' then v_contract.own_commission_pct
    else v_contract.transferred_commission_pct
  end;

  v_tolerance := round(v_advice * v_contract.price_tolerance_pct / 100, 2);
  v_deduction := greatest(0, v_discount - v_tolerance);
  v_commission := greatest(0, round(v_advice * v_pct / 100, 2) - v_deduction);

  -- --- Deel van de subagent ------------------------------------------------
  if v_sub_contract.id is not null then
    v_sub_pct := case
      when v_architect.origin = 'agent_signed' then v_sub_contract.subagent_own_pct
      else v_sub_contract.subagent_transferred_pct
    end;

    if v_sub_pct is not null and v_pct > 0 then
      v_sub_amount := greatest(
        0,
        round(v_advice * v_sub_pct / 100, 2) - round(v_deduction * v_sub_pct / v_pct, 2)
      );
    end if;
  end if;

  return query select
    true, null::text,
    v_advice, v_sale, v_discount, v_tolerance, v_deduction, v_pct, v_commission,
    v_contract.id,
    public.contract_year_for(v_contract.start_date, v_order.order_date),
    v_payable_agent_id,
    case when v_agent.parent_agent_id is not null then v_agent.id end,
    v_sub_pct, v_sub_amount,
    v_sub_contract.id,
    public.contract_year_for(v_sub_contract.start_date, v_order.order_date);
end;
$$;

revoke all on function public.calculate_commission(uuid) from public;
revoke all on function public.contract_year_for(date, date) from public;
grant execute on function public.calculate_commission(uuid) to authenticated;
grant execute on function public.contract_year_for(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Ledger vullen zodra een order op 'betaald' komt, en verrekenen bij
-- retour of annulering daarna.
-- ---------------------------------------------------------------------------
create or replace function public.fn_orders_commission_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_clawback_enabled boolean;
  v_entry record;
begin
  -- Order wordt betaald: commissie toekennen.
  if new.status = 'betaald' and old.status is distinct from 'betaald' then
    -- Dubbele toekenning voorkomen als een order opnieuw op betaald komt.
    if exists (
      select 1 from public.commission_entries e
      where e.order_id = new.id and e.kind in ('commission', 'subagent_share')
    ) then
      return null;
    end if;

    select * into c from public.calculate_commission(new.id);

    if c is null or not c.eligible or c.commission is null or c.commission = 0 then
      return null;
    end if;

    insert into public.commission_entries (
      agent_id, order_id, architect_id, kind, payable_by,
      base_amount, pct, discount_deduction, amount,
      contract_id, contract_year
    )
    values (
      c.payable_agent_id, new.id, new.architect_id, 'commission', 'koreman',
      c.advice_total, c.pct, c.discount_deduction, c.commission,
      c.contract_id, c.contract_year
    );

    -- Informatieve vastlegging van wat de hoofdagent doorgeeft.
    if c.subagent_agent_id is not null
       and c.subagent_amount is not null
       and c.subagent_amount > 0 then
      insert into public.commission_entries (
        agent_id, order_id, architect_id, kind, payable_by,
        base_amount, pct, discount_deduction, amount,
        contract_id, contract_year
      )
      values (
        c.subagent_agent_id, new.id, new.architect_id, 'subagent_share', 'parent_agent',
        c.advice_total, c.subagent_pct,
        round(c.discount_deduction * c.subagent_pct / nullif(c.pct, 0), 2),
        c.subagent_amount,
        c.subagent_contract_id, c.subagent_contract_year
      );
    end if;

    return null;
  end if;

  -- Retour of annulering ná uitbetaling: verrekenen als het contract dat zegt.
  if old.status = 'betaald' and new.status in ('retour', 'geannuleerd') then
    for v_entry in
      select * from public.commission_entries e
      where e.order_id = new.id
        and e.kind in ('commission', 'subagent_share')
    loop
      select coalesce(ct.clawback_enabled, true) into v_clawback_enabled
      from public.contracts ct where ct.id = v_entry.contract_id;

      if coalesce(v_clawback_enabled, true) then
        insert into public.commission_entries (
          agent_id, order_id, architect_id, kind, payable_by,
          base_amount, pct, discount_deduction, amount,
          contract_id, contract_year, note
        )
        values (
          v_entry.agent_id, new.id, v_entry.architect_id, 'clawback', v_entry.payable_by,
          v_entry.base_amount, v_entry.pct, v_entry.discount_deduction,
          -v_entry.amount,
          v_entry.contract_id, v_entry.contract_year,
          format('Verrekening na status %s', new.status)
        );
      end if;
    end loop;
  end if;

  return null;
end;
$$;

create trigger orders_commission_ledger
after update of status on public.orders
for each row execute function public.fn_orders_commission_ledger();

-- ---------------------------------------------------------------------------
-- RLS: de ledger is alleen-lezen voor agenten en append-only voor Koreman.
-- ---------------------------------------------------------------------------
alter table public.commission_entries enable row level security;

create policy commission_entries_select on public.commission_entries
for select to authenticated
using (public.is_admin() or agent_id in (select public.visible_agent_ids()));

-- Koreman mag alleen handmatige correcties toevoegen; de rest komt van de
-- trigger, die als security definer langs RLS gaat.
create policy commission_entries_insert_correction on public.commission_entries
for insert to authenticated
with check (public.is_admin() and kind = 'correction');

-- Geen update- of delete-policy: een ledger wordt gecorrigeerd, niet herschreven.
