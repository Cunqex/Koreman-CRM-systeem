/**
 * Hand-maintained mirror of the SQL schema in supabase/migrations.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * and keep the domain aliases at the bottom of this file.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'agent' | 'subagent';
export type Province =
  | 'Drenthe'
  | 'Flevoland'
  | 'Friesland'
  | 'Gelderland'
  | 'Groningen'
  | 'Limburg'
  | 'Noord-Brabant'
  | 'Noord-Holland'
  | 'Overijssel'
  | 'Utrecht'
  | 'Zeeland'
  | 'Zuid-Holland';
export type PostcodeExceptionKind = 'include' | 'exclude';
export type TargetScope = 'own' | 'transferred' | 'total';
export type ArchitectOrigin = 'agent_signed' | 'koreman_transferred';
export type ArchitectStatus = 'lead' | 'actief' | 'klant' | 'inactief';
export type ClaimStatus = 'agent' | 'koreman_maintained' | 'revoked';
export type ProjectStatus = 'lopend' | 'afgerond' | 'vervallen';
export type ActivityType =
  | 'telefoon'
  | 'email'
  | 'bezoek'
  | 'meeting'
  | 'showroomafspraak'
  | 'stalen'
  | 'offerte'
  | 'presentatie';
export type OrderStatus =
  | 'ingediend'
  | 'goedgekeurd'
  | 'afgekeurd'
  | 'betaald'
  | 'geannuleerd'
  | 'retour';
export type OrderLineShape =
  | 'rechthoek'
  | 'rond'
  | 'ovaal'
  | 'organisch'
  | 'anders';
export type CommissionKind =
  | 'commission'
  | 'subagent_share'
  | 'clawback'
  | 'correction';
export type CommissionPayableBy = 'koreman' | 'parent_agent';
export type ClaimActionType =
  | 'koreman_takes_over'
  | 'revoke_claim'
  | 'restore_claim'
  | 'reassign'
  | 'revoke_region'
  | 'restore_region';
export type AuditAction = 'insert' | 'update';
export type NotificationType =
  | 'architect_created'
  | 'architect_out_of_region'
  | 'architect_possible_duplicate'
  | 'order_submitted'
  | 'architect_inactive'
  | 'contract_year_end'
  | 'order_approved'
  | 'order_rejected'
  | 'order_paid'
  | 'claim_changed'
  | 'follow_up_due';

type Timestamps = {
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type ProfileRow = Timestamps & {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  parent_agent_id: string | null;
  language: 'nl' | 'en';
  is_active: boolean;
};

export type ContractRow = Timestamps & {
  id: string;
  agent_id: string;
  start_date: string;
  end_date: string | null;
  contract_file_path: string | null;
  own_commission_pct: number;
  transferred_commission_pct: number;
  subagent_own_pct: number | null;
  subagent_transferred_pct: number | null;
  inactivity_days: number;
  price_tolerance_pct: number;
  clawback_enabled: boolean;
  region_claim_active: boolean;
  notes: string | null;
};

export type ContractRegionRow = {
  id: string;
  contract_id: string;
  province: Province;
  created_at: string;
};

export type ContractPostcodeExceptionRow = {
  id: string;
  contract_id: string;
  postcode_from: number;
  postcode_to: number;
  kind: PostcodeExceptionKind;
  note: string | null;
  created_at: string;
};

export type ContractTargetRow = {
  id: string;
  contract_id: string;
  label: string;
  scope: TargetScope;
  amount: number;
  created_at: string;
};

export type PostcodeProvinceRow = {
  postcode_from: number;
  postcode_to: number;
  province: Province;
};

export type ArchitectRow = Timestamps & {
  id: string;
  agent_id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  province: Province | null;
  origin: ArchitectOrigin;
  transferred_at: string | null;
  excluded_from_commission: boolean;
  exclusion_reason: string | null;
  status: ArchitectStatus;
  claim_status: ClaimStatus;
  in_region: boolean;
  region_override: boolean;
  last_activity_at: string | null;
  notes: string | null;
};

export type ArchitectAgreementRow = Timestamps & {
  id: string;
  architect_id: string;
  trade_discount_pct: number | null;
  payment_terms: string | null;
  lead_time_agreement: string | null;
  samples_arrangement: string | null;
  delivery_agreement: string | null;
  exclusive_collection_agreed: boolean;
  other_agreements: string | null;
  notes: string | null;
};

export type DocumentRow = {
  id: string;
  architect_id: string | null;
  project_id: string | null;
  order_id: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type ProjectRow = Timestamps & {
  id: string;
  architect_id: string;
  name: string;
  city: string | null;
  status: ProjectStatus;
  end_client_name: string | null;
  end_client_email: string | null;
  end_client_phone: string | null;
  notes: string | null;
};

export type ActivityRow = Timestamps & {
  id: string;
  architect_id: string;
  project_id: string | null;
  agent_id: string;
  type: ActivityType;
  activity_date: string;
  subject: string;
  notes: string | null;
  follow_up_date: string | null;
  follow_up_note: string | null;
  follow_up_done: boolean;
  edited_at: string | null;
};

export type CollectionRow = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  is_exclusive: boolean;
  exclusive_architect_id: string | null;
};

export type OrderRow = Timestamps & {
  id: string;
  architect_id: string;
  project_id: string | null;
  agent_id: string;
  order_date: string;
  reference: string | null;
  status: OrderStatus;
  shipping_cost: number;
  installation_cost: number;
  agent_notes: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
};

export type OrderLineRow = {
  id: string;
  order_id: string;
  collection_id: string | null;
  design_name: string | null;
  width_cm: number | null;
  length_cm: number | null;
  shape: OrderLineShape | null;
  custom_edits: string | null;
  quantity: number;
  advice_price: number;
  sale_price: number;
  created_at: string;
  updated_at: string;
};

export type CommissionEntryRow = {
  id: string;
  agent_id: string;
  order_id: string | null;
  architect_id: string | null;
  kind: CommissionKind;
  payable_by: CommissionPayableBy;
  base_amount: number;
  pct: number | null;
  discount_deduction: number;
  amount: number;
  contract_id: string | null;
  contract_year: number | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

export type ClaimActionRow = {
  id: string;
  architect_id: string | null;
  contract_id: string | null;
  action: ClaimActionType;
  reason: string;
  performed_by: string | null;
  performed_at: string;
  new_agent_id: string | null;
};

export type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  old_data: Json | null;
  new_data: Json | null;
  user_id: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type AgentRevenueView = {
  agent_id: string;
  contract_id: string;
  contract_year: number;
  year_start: string;
  year_end: string;
  own_revenue: number;
  transferred_revenue: number;
  total_revenue: number;
};

export type TargetProgressView = {
  contract_id: string;
  agent_id: string;
  target_id: string;
  label: string;
  scope: TargetScope;
  target_amount: number;
  contract_year: number;
  year_start: string;
  year_end: string;
  achieved_amount: number;
  year_closed: boolean;
  target_met: boolean | null;
};

export type AgentActivityStatsView = {
  agent_id: string;
  period_week: string;
  period_month: string;
  type: ActivityType;
  activity_count: number;
};

export type InactiveArchitectView = {
  id: string;
  agent_id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  status: ArchitectStatus;
  last_activity_at: string | null;
  days_inactive: number | null;
  inactivity_days: number;
};

export type PipelineView = {
  agent_id: string;
  status: ArchitectStatus;
  architect_count: number;
  lead_to_customer_pct: number | null;
};

export type CommissionSummaryView = {
  agent_id: string;
  contract_year: number | null;
  quarter: number | null;
  payable_by: CommissionPayableBy;
  total_amount: number;
};

/**
 * Eén rij uit calculate_commission(order_id). Gebruikt in de order-UI om live
 * de korting en de geschatte commissie te tonen.
 */
export type CommissionCalculation = {
  eligible: boolean;
  /** Waarom er geen commissie is: architect_excluded, claim_not_with_agent,
   *  no_contract of order_before_transfer. */
  ineligible_reason: string | null;
  advice_total: number;
  sale_total: number;
  discount: number;
  tolerance: number;
  discount_deduction: number;
  pct: number;
  commission: number;
  contract_id: string | null;
  contract_year: number | null;
  /** Aan wie Koreman de commissie verschuldigd is (bij een subagent: de hoofdagent). */
  payable_agent_id: string | null;
  subagent_agent_id: string | null;
  subagent_pct: number | null;
  subagent_amount: number | null;
  subagent_contract_id: string | null;
  subagent_contract_year: number | null;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      contracts: Table<ContractRow>;
      contract_regions: Table<ContractRegionRow>;
      contract_postcode_exceptions: Table<ContractPostcodeExceptionRow>;
      contract_targets: Table<ContractTargetRow>;
      postcode_provinces: Table<PostcodeProvinceRow>;
      architects: Table<ArchitectRow>;
      architect_agreements: Table<ArchitectAgreementRow>;
      documents: Table<DocumentRow>;
      projects: Table<ProjectRow>;
      activities: Table<ActivityRow>;
      collections: Table<CollectionRow>;
      orders: Table<OrderRow>;
      order_lines: Table<OrderLineRow>;
      commission_entries: Table<CommissionEntryRow>;
      claim_actions: Table<ClaimActionRow>;
      audit_log: Table<AuditLogRow>;
      notifications: Table<NotificationRow>;
    };
    Views: {
      v_agent_revenue: View<AgentRevenueView>;
      v_target_progress: View<TargetProgressView>;
      v_agent_activity_stats: View<AgentActivityStatsView>;
      v_inactive_architects: View<InactiveArchitectView>;
      v_pipeline: View<PipelineView>;
      v_commission_summary: View<CommissionSummaryView>;
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      visible_agent_ids: { Args: Record<string, never>; Returns: string[] };
      province_for_postcode: {
        Args: { p_postcode: string };
        Returns: Province | null;
      };
      architect_in_region: {
        Args: { p_agent_id: string; p_postcode: string };
        Returns: boolean;
      };
      calculate_commission: {
        Args: { p_order_id: string };
        Returns: CommissionCalculation[];
      };
      find_duplicate_architects: {
        Args: {
          p_email: string | null;
          p_last_name: string | null;
          p_postcode: string | null;
        };
        Returns: { architect_id: string; match_reason: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      province: Province;
      architect_origin: ArchitectOrigin;
      architect_status: ArchitectStatus;
      claim_status: ClaimStatus;
      project_status: ProjectStatus;
      activity_type: ActivityType;
      order_status: OrderStatus;
      order_line_shape: OrderLineShape;
      commission_kind: CommissionKind;
      commission_payable_by: CommissionPayableBy;
      claim_action_type: ClaimActionType;
      target_scope: TargetScope;
      postcode_exception_kind: PostcodeExceptionKind;
      audit_action: AuditAction;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
};
