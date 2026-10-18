import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  ClaimActionRow,
  ContractPostcodeExceptionRow,
  ContractRegionRow,
  ContractRow,
  ContractTargetRow,
  TargetProgressView,
} from '@/types/database';

export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: async (): Promise<ContractRow[]> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useContract(contractId: string | undefined) {
  return useQuery({
    queryKey: ['contract-detail', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<ContractRow | null> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Het lopende contract van de ingelogde agent (of subagent). */
export function useMyContract(agentId: string | undefined) {
  return useQuery({
    queryKey: ['my-contract', agentId],
    enabled: Boolean(agentId),
    queryFn: async (): Promise<ContractRow | null> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('agent_id', agentId!)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useContractRegions(contractId: string | undefined) {
  return useQuery({
    queryKey: ['contract-regions', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<ContractRegionRow[]> => {
      const { data, error } = await supabase
        .from('contract_regions')
        .select('*')
        .eq('contract_id', contractId!)
        .order('province');
      if (error) throw error;
      return data;
    },
  });
}

export function useContractExceptions(contractId: string | undefined) {
  return useQuery({
    queryKey: ['contract-exceptions', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<ContractPostcodeExceptionRow[]> => {
      const { data, error } = await supabase
        .from('contract_postcode_exceptions')
        .select('*')
        .eq('contract_id', contractId!)
        .order('postcode_from');
      if (error) throw error;
      return data;
    },
  });
}

export function useContractTargets(contractId: string | undefined) {
  return useQuery({
    queryKey: ['contract-targets', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<ContractTargetRow[]> => {
      const { data, error } = await supabase
        .from('contract_targets')
        .select('*')
        .eq('contract_id', contractId!)
        .order('scope');
      if (error) throw error;
      return data;
    },
  });
}

/** Behaald bedrag per target per contractjaar, uit de view met RLS. */
export function useTargetProgress(contractId: string | undefined) {
  return useQuery({
    queryKey: ['target-progress', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<TargetProgressView[]> => {
      const { data, error } = await supabase
        .from('v_target_progress')
        .select('*')
        .eq('contract_id', contractId!)
        .order('contract_year');
      if (error) throw error;
      return data as TargetProgressView[];
    },
  });
}

export function useContractClaimActions(contractId: string | undefined) {
  return useQuery({
    queryKey: ['contract-claims', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<ClaimActionRow[]> => {
      const { data, error } = await supabase
        .from('claim_actions')
        .select('*')
        .eq('contract_id', contractId!)
        .order('performed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
