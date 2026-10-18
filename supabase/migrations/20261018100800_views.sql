-- Fase 2 — Rapportage-views.
--
-- Allemaal met security_invoker = true, zodat de RLS van de onderliggende
-- tabellen blijft gelden en een agent via een view niets extra's ziet.

-- Omzet = verkoopprijs van betaalde orders, excl. btw en excl. verzend- en
-- montagekosten (die staan los op de order en tellen niet mee).
create view public.v_agent_revenue with (security_invoker = true) as
with contract_years as (
  select
    c.id as contract_id,
    c.agent_id,
    gs.n as contract_year,
    (c.start_date + make_interval(years => gs.n - 1))::date as year_start,
    (c.start_date + make_interval(years => gs.n) - 1)::date as year_end
  from public.contracts c
  cross join lateral generate_series(
    1,
    greatest(
      1,
      coalesce(
        public.contract_year_for(
          c.start_date,
          least(coalesce(c.end_date, current_date), current_date)
        ),
        1
      )
    )
  ) as gs(n)
),
paid_orders as (
  select
    o.id,
    o.agent_id,
    o.order_date,
    a.origin,
    coalesce(sum(l.sale_price), 0) as sale_total
  from public.orders o
  join public.architects a on a.id = o.architect_id
  left join public.order_lines l on l.order_id = o.id
  where o.status = 'betaald'
  group by o.id, o.agent_id, o.order_date, a.origin
)
select
  cy.agent_id,
  cy.contract_id,
  cy.contract_year,
  cy.year_start,
  cy.year_end,
  coalesce(sum(po.sale_total) filter (where po.origin = 'agent_signed'), 0)::numeric(12, 2)
    as own_revenue,
  coalesce(sum(po.sale_total) filter (where po.origin = 'koreman_transferred'), 0)::numeric(12, 2)
    as transferred_revenue,
  coalesce(sum(po.sale_total), 0)::numeric(12, 2) as total_revenue
from contract_years cy
left join paid_orders po
  on po.agent_id = cy.agent_id
 and po.order_date between cy.year_start and cy.year_end
group by cy.agent_id, cy.contract_id, cy.contract_year, cy.year_start, cy.year_end;

-- Targets neutraal: bedrag, behaald en of het contractjaar al voorbij is.
create view public.v_target_progress with (security_invoker = true) as
select
  t.contract_id,
  r.agent_id,
  t.id as target_id,
  t.label,
  t.scope,
  t.amount as target_amount,
  r.contract_year,
  r.year_start,
  r.year_end,
  case t.scope
    when 'own' then r.own_revenue
    when 'transferred' then r.transferred_revenue
    else r.total_revenue
  end as achieved_amount,
  (r.year_end < current_date) as year_closed,
  case
    when r.year_end < current_date then
      (case t.scope
         when 'own' then r.own_revenue
         when 'transferred' then r.transferred_revenue
         else r.total_revenue
       end) >= t.amount
  end as target_met
from public.contract_targets t
join public.v_agent_revenue r on r.contract_id = t.contract_id;

-- Activiteiten per agent, per week en per maand, per soort.
create view public.v_agent_activity_stats with (security_invoker = true) as
select
  ac.agent_id,
  date_trunc('week', ac.activity_date::timestamp)::date as period_week,
  date_trunc('month', ac.activity_date::timestamp)::date as period_month,
  ac.type,
  count(*)::bigint as activity_count
from public.activities ac
group by ac.agent_id, period_week, period_month, ac.type;

-- Architecten die langer dan inactivity_days zonder activiteit zitten.
create view public.v_inactive_architects with (security_invoker = true) as
select
  a.id,
  a.agent_id,
  a.first_name,
  a.last_name,
  a.company_name,
  a.status,
  a.last_activity_at,
  case
    when a.last_activity_at is null then null
    else (current_date - a.last_activity_at::date)
  end as days_inactive,
  coalesce(c.inactivity_days, 60) as inactivity_days
from public.architects a
left join lateral (
  select * from public.contract_for_agent_on(a.agent_id, current_date)
) c on true
where a.status <> 'inactief'
  and (
    a.last_activity_at is null
    or a.last_activity_at < now() - make_interval(days => coalesce(c.inactivity_days, 60))
  );

-- Aantallen per status per agent, plus de conversie lead -> klant.
create view public.v_pipeline with (security_invoker = true) as
select
  a.agent_id,
  a.status,
  count(*)::bigint as architect_count,
  case
    when count(*) over (partition by a.agent_id) = 0 then null
    else round(
      100.0
      * sum(count(*)) filter (where a.status = 'klant') over (partition by a.agent_id)
      / nullif(sum(count(*)) over (partition by a.agent_id), 0),
      1
    )
  end as lead_to_customer_pct
from public.architects a
group by a.agent_id, a.status;

-- Commissie per agent, per contractjaar en kwartaal.
create view public.v_commission_summary with (security_invoker = true) as
select
  e.agent_id,
  e.contract_year,
  extract(quarter from e.created_at)::int as quarter,
  e.payable_by,
  sum(e.amount)::numeric(12, 2) as total_amount
from public.commission_entries e
group by e.agent_id, e.contract_year, quarter, e.payable_by;

grant select on public.v_agent_revenue to authenticated;
grant select on public.v_target_progress to authenticated;
grant select on public.v_agent_activity_stats to authenticated;
grant select on public.v_inactive_architects to authenticated;
grant select on public.v_pipeline to authenticated;
grant select on public.v_commission_summary to authenticated;
