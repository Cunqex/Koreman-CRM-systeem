-- Fase 2 — Enums en extensies.
-- Alle bedragen in dit schema zijn numeric(12,2) en altijd EXCLUSIEF btw.

create extension if not exists "pgcrypto" with schema extensions;

create type public.user_role as enum ('admin', 'agent', 'subagent');

create type public.province as enum (
  'Drenthe',
  'Flevoland',
  'Friesland',
  'Gelderland',
  'Groningen',
  'Limburg',
  'Noord-Brabant',
  'Noord-Holland',
  'Overijssel',
  'Utrecht',
  'Zeeland',
  'Zuid-Holland'
);

create type public.postcode_exception_kind as enum ('include', 'exclude');

create type public.target_scope as enum ('own', 'transferred', 'total');

create type public.architect_origin as enum ('agent_signed', 'koreman_transferred');

create type public.architect_status as enum ('lead', 'actief', 'klant', 'inactief');

create type public.claim_status as enum ('agent', 'koreman_maintained', 'revoked');

create type public.project_status as enum ('lopend', 'afgerond', 'vervallen');

create type public.activity_type as enum (
  'telefoon',
  'email',
  'bezoek',
  'meeting',
  'showroomafspraak',
  'stalen',
  'offerte',
  'presentatie'
);

create type public.order_status as enum (
  'ingediend',
  'goedgekeurd',
  'afgekeurd',
  'betaald',
  'geannuleerd',
  'retour'
);

create type public.order_line_shape as enum (
  'rechthoek',
  'rond',
  'ovaal',
  'organisch',
  'anders'
);

create type public.commission_kind as enum (
  'commission',
  'subagent_share',
  'clawback',
  'correction'
);

create type public.commission_payable_by as enum ('koreman', 'parent_agent');

create type public.claim_action_type as enum (
  'koreman_takes_over',
  'revoke_claim',
  'restore_claim',
  'reassign',
  'revoke_region',
  'restore_region'
);

create type public.audit_action as enum ('insert', 'update');

create type public.notification_type as enum (
  'architect_created',
  'architect_out_of_region',
  'architect_possible_duplicate',
  'order_submitted',
  'architect_inactive',
  'contract_year_end',
  'order_approved',
  'order_rejected',
  'order_paid',
  'claim_changed',
  'follow_up_due'
);
