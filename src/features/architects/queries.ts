import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  ArchitectRow,
  OrderLineRow,
  OrderRow,
  ProfileRow,
} from '@/types/database';

/**
 * Een order met zijn regels. De handgeschreven Database-typen beschrijven geen
 * relaties, dus een embedded select wordt hier expliciet getypeerd in plaats
 * van afgeleid.
 */
export type OrderWithLines = OrderRow & { order_lines: OrderLineRow[] };

/** Alle architecten die de ingelogde gebruiker mag zien. RLS bepaalt de scope. */
export function useArchitects() {
  return useQuery({
    queryKey: ['architects'],
    queryFn: async (): Promise<ArchitectRow[]> => {
      const { data, error } = await supabase
        .from('architects')
        .select('*')
        .order('last_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useArchitect(architectId: string | undefined) {
  return useQuery({
    queryKey: ['architect', architectId],
    enabled: Boolean(architectId),
    queryFn: async (): Promise<ArchitectRow | null> => {
      const { data, error } = await supabase
        .from('architects')
        .select('*')
        .eq('id', architectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Profielen die de gebruiker mag zien, als lookup voor agentnamen.
 * Voor een agent zijn dat zichzelf, zijn subagenten en de Koreman-accounts.
 */
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useProjects(architectId?: string) {
  return useQuery({
    queryKey: ['projects', architectId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('projects').select('*');
      if (architectId) query = query.eq('architect_id', architectId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAgreement(architectId: string | undefined) {
  return useQuery({
    queryKey: ['agreement', architectId],
    enabled: Boolean(architectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('architect_agreements')
        .select('*')
        .eq('architect_id', architectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDocuments(architectId: string | undefined) {
  return useQuery({
    queryKey: ['documents', architectId],
    enabled: Boolean(architectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('architect_id', architectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useArchitectActivities(architectId: string | undefined) {
  return useQuery({
    queryKey: ['activities', architectId],
    enabled: Boolean(architectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('architect_id', architectId!)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useArchitectOrders(architectId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'architect', architectId],
    enabled: Boolean(architectId),
    queryFn: async (): Promise<OrderWithLines[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_lines(*)')
        .eq('architect_id', architectId!)
        .order('order_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithLines[];
    },
  });
}

export function useArchitectCommission(architectId: string | undefined) {
  return useQuery({
    queryKey: ['commission', 'architect', architectId],
    enabled: Boolean(architectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_entries')
        .select('*')
        .eq('architect_id', architectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
