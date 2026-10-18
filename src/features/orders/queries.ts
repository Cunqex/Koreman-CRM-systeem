import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  CollectionRow,
  CommissionCalculation,
  CommissionEntryRow,
  ContractRow,
} from '@/types/database';
import type { OrderWithLines } from '@/features/architects/queries';

export function useOrders() {
  return useQuery({
    queryKey: ['orders', 'all'],
    queryFn: async (): Promise<OrderWithLines[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_lines(*)')
        .order('order_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithLines[];
    },
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order', orderId],
    enabled: Boolean(orderId),
    queryFn: async (): Promise<OrderWithLines | null> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_lines(*)')
        .eq('id', orderId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as OrderWithLines | null;
    },
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CollectionRow[]> => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Het contract dat op de orderdatum liep, voor de commissie-indicatie. */
export function useContractForAgent(agentId?: string, onDate?: string) {
  return useQuery({
    queryKey: ['contract', agentId, onDate],
    enabled: Boolean(agentId && onDate),
    queryFn: async (): Promise<ContractRow | null> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('agent_id', agentId!)
        .lte('start_date', onDate!)
        .or(`end_date.is.null,end_date.gte.${onDate!}`)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** De berekening zoals de database hem doet; pas bruikbaar als de order bestaat. */
export function useCommissionCalculation(orderId: string | undefined) {
  return useQuery({
    queryKey: ['commission-calc', orderId],
    enabled: Boolean(orderId),
    queryFn: async (): Promise<CommissionCalculation | null> => {
      const { data, error } = await supabase.rpc('calculate_commission', {
        p_order_id: orderId!,
      });
      if (error) throw error;
      const rows = (data ?? []) as CommissionCalculation[];
      return rows[0] ?? null;
    },
  });
}

export function useCommissionEntries(orderId?: string) {
  return useQuery({
    queryKey: ['commission-entries', orderId ?? 'all'],
    queryFn: async (): Promise<CommissionEntryRow[]> => {
      let query = supabase.from('commission_entries').select('*');
      if (orderId) query = query.eq('order_id', orderId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
