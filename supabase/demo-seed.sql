-- DEMO-DATA. Niet draaien op productie.
--
-- Gescheiden van seed.sql: dit bestand maakt fictieve agenten, architecten,
-- activiteiten en orders om het portaal mee te bekijken.
--
-- Vooraf: maak deze vier gebruikers aan in Supabase (Authentication > Users,
-- of via de invite-user Edge Function). Dit script zoekt ze op e-mailadres op
-- en stopt netjes als ze er nog niet zijn.
--
--   demo-admin@koreman.test
--   demo-agent@koreman.test
--   demo-subagent@koreman.test
--   demo-agent2@koreman.test

do $$
declare
  v_admin uuid;
  v_agent uuid;
  v_sub uuid;
  v_agent2 uuid;
  v_contract_agent uuid;
  v_contract_sub uuid;
  v_contract_agent2 uuid;
  v_arch1 uuid;
  v_arch2 uuid;
  v_arch3 uuid;
  v_arch4 uuid;
  v_project uuid;
  v_order uuid;
  v_strata uuid;
  v_terra uuid;
begin
  select id into v_admin  from auth.users where email = 'demo-admin@koreman.test';
  select id into v_agent  from auth.users where email = 'demo-agent@koreman.test';
  select id into v_sub    from auth.users where email = 'demo-subagent@koreman.test';
  select id into v_agent2 from auth.users where email = 'demo-agent2@koreman.test';

  if v_admin is null or v_agent is null or v_sub is null or v_agent2 is null then
    raise notice 'Demo-gebruikers ontbreken in auth.users. Maak ze eerst aan; er is niets gewijzigd.';
    return;
  end if;

  -- ---- profielen ---------------------------------------------------------
  insert into public.profiles (id, role, full_name, email, company_name, parent_agent_id)
  values
    (v_admin,  'admin',    'Demo Koreman',   'demo-admin@koreman.test',    'Koreman Maastricht', null),
    (v_agent,  'agent',    'Demo Agentschap','demo-agent@koreman.test',    'Studio Zuid',        null),
    (v_agent2, 'agent',    'Demo Agent Noord','demo-agent2@koreman.test',  'Noord Interieur',    null),
    (v_sub,    'subagent', 'Demo Subagent',  'demo-subagent@koreman.test', 'Studio Zuid',        v_agent)
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name,
        parent_agent_id = excluded.parent_agent_id;

  -- ---- contracten --------------------------------------------------------
  insert into public.contracts
    (agent_id, start_date, own_commission_pct, transferred_commission_pct,
     price_tolerance_pct, inactivity_days, notes)
  values
    (v_agent, current_date - 400, 12.5, 5, 2, 60, 'Demo-contract hoofdagent')
  returning id into v_contract_agent;

  insert into public.contracts
    (agent_id, start_date, own_commission_pct, transferred_commission_pct,
     subagent_own_pct, subagent_transferred_pct, price_tolerance_pct, notes)
  values
    (v_sub, current_date - 200, 12.5, 5, 9, 4, 2, 'Demo-contract subagent')
  returning id into v_contract_sub;

  insert into public.contracts
    (agent_id, start_date, own_commission_pct, transferred_commission_pct, notes)
  values
    (v_agent2, current_date - 150, 12.5, 5, 'Demo-contract tweede agent')
  returning id into v_contract_agent2;

  insert into public.contract_regions (contract_id, province) values
    (v_contract_agent,  'Limburg'),
    (v_contract_agent,  'Noord-Brabant'),
    (v_contract_sub,    'Limburg'),
    (v_contract_agent2, 'Noord-Holland');

  insert into public.contract_postcode_exceptions
    (contract_id, postcode_from, postcode_to, kind, note)
  values
    (v_contract_agent, 5000, 5099, 'exclude', 'Tilburg blijft bij Koreman'),
    (v_contract_agent, 3500, 3599, 'include', 'Utrecht-stad als uitzondering toegevoegd');

  insert into public.contract_targets (contract_id, label, scope, amount) values
    (v_contract_agent, 'Zelf getekend',  'own',         300000),
    (v_contract_agent, 'Overgedragen',   'transferred',  50000),
    (v_contract_sub,   'Eigen omzet',    'own',         120000);

  -- ---- architecten -------------------------------------------------------
  insert into public.architects
    (agent_id, first_name, last_name, company_name, email, phone,
     street, postcode, city, origin, status, notes)
  values
    (v_agent, 'Anna', 'Jansen', 'Jansen Interieurarchitectuur',
     'anna@jansen-ia.test', '043-1234567',
     'Grote Gracht 12', '6211 SW', 'Maastricht', 'agent_signed', 'klant',
     'Werkt veel met wol, vraagt vaak om stalen.')
  returning id into v_arch1;

  insert into public.architects
    (agent_id, first_name, last_name, company_name, email,
     street, postcode, city, origin, transferred_at, status)
  values
    (v_agent, 'Bram', 'de Vries', 'DV Studio', 'bram@dvstudio.test',
     'Vughterstraat 3', '5211 EX', 's-Hertogenbosch',
     'koreman_transferred', current_date - 180, 'actief')
  returning id into v_arch2;

  insert into public.architects
    (agent_id, first_name, last_name, company_name, email,
     street, postcode, city, origin, status)
  values
    (v_sub, 'Carla', 'Peters', 'Peters & Co', 'carla@petersco.test',
     'Saroleastraat 40', '6411 HH', 'Heerlen', 'agent_signed', 'actief')
  returning id into v_arch3;

  -- Buiten de regio van de agent: valt in Noord-Holland.
  insert into public.architects
    (agent_id, first_name, last_name, company_name,
     street, postcode, city, origin, status)
  values
    (v_agent, 'Daan', 'Bakker', 'Bakker Design',
     'Keizersgracht 100', '1015 CS', 'Amsterdam', 'agent_signed', 'lead')
  returning id into v_arch4;

  insert into public.architect_agreements
    (architect_id, trade_discount_pct, payment_terms, lead_time_agreement,
     samples_arrangement, exclusive_collection_agreed)
  values
    (v_arch1, 15, '30 dagen netto', '8 tot 10 weken voor maatwerk',
     'Maximaal 5 stalen tegelijk, retour binnen 4 weken', false);

  -- ---- projecten ---------------------------------------------------------
  insert into public.projects (architect_id, name, city, status, end_client_name)
  values (v_arch1, 'Penthouse Wyck', 'Maastricht', 'lopend', 'Familie Smeets')
  returning id into v_project;

  insert into public.projects (architect_id, name, city, status)
  values (v_arch3, 'Kantoor Heerlen-Centrum', 'Heerlen', 'lopend');

  -- ---- activiteiten ------------------------------------------------------
  insert into public.activities
    (architect_id, project_id, agent_id, type, activity_date, subject, notes,
     follow_up_date, follow_up_note)
  values
    (v_arch1, v_project, v_agent, 'bezoek', current_date - 21,
     'Kennismaking op kantoor', 'Collectie Strata en Terra getoond.',
     current_date - 7, 'Stalen nabellen'),
    (v_arch1, v_project, v_agent, 'stalen', current_date - 14,
     'Stalen Strata verstuurd', 'Drie kleurstellingen opgestuurd.', null, null),
    (v_arch1, v_project, v_agent, 'offerte', current_date - 5,
     'Offerte penthouse verstuurd', 'Twee kleden, maatwerk.', current_date + 3, 'Reactie afwachten'),
    (v_arch2, null, v_agent, 'telefoon', current_date - 70,
     'Status doorgenomen', 'Loopt nu niets.', null, null),
    (v_arch3, null, v_sub, 'showroomafspraak', current_date - 3,
     'Showroombezoek Heerlen', 'Interesse in Flatwave.', null, null);

  -- ---- order met regels --------------------------------------------------
  select id into v_strata from public.collections where name = 'Strata';
  select id into v_terra  from public.collections where name = 'Terra';

  insert into public.orders
    (architect_id, project_id, agent_id, order_date, reference, status,
     shipping_cost, installation_cost, agent_notes)
  values
    (v_arch1, v_project, v_agent, current_date - 2, 'KOR-2026-0041', 'ingediend',
     250, 400, 'Spoed: oplevering penthouse in november.')
  returning id into v_order;

  insert into public.order_lines
    (order_id, collection_id, design_name, width_cm, length_cm, shape,
     custom_edits, quantity, advice_price, sale_price)
  values
    (v_order, v_strata, 'Strata Dune', 300, 400, 'rechthoek',
     'Kleur op maat, wolmix, geborstelde rand', 1, 18500, 17800),
    (v_order, v_terra, 'Terra Ochre', 250, 250, 'rond',
     'Standaard afwerking', 1, 9200, 9200);

  raise notice 'Demo-data geplaatst.';
end
$$;
