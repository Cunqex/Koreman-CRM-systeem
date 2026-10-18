import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useArchitects } from '@/features/architects/queries';
import { useOrders } from '@/features/orders/queries';
import type { OrderWithLines } from '@/features/architects/queries';
import type {
  ActivityRow,
  AgentRevenueView,
  CommissionEntryRow,
  InactiveArchitectView,
} from '@/types/database';

export function useInactiveArchitects() {
  return useQuery({
    queryKey: ['v-inactive-architects'],
    queryFn: async (): Promise<InactiveArchitectView[]> => {
      const { data, error } = await supabase
        .from('v_inactive_architects')
        .select('*')
        .order('last_activity_at', { nullsFirst: true });
      if (error) throw error;
      return data as InactiveArchitectView[];
    },
  });
}

export function useAgentRevenue() {
  return useQuery({
    queryKey: ['v-agent-revenue'],
    queryFn: async (): Promise<AgentRevenueView[]> => {
      const { data, error } = await supabase
        .from('v_agent_revenue')
        .select('*')
        .order('contract_year');
      if (error) throw error;
      return data as AgentRevenueView[];
    },
  });
}

export function useRecentActivities(limit = 400) {
  return useQuery({
    queryKey: ['activities', 'recent', limit],
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useAllCommissionEntries() {
  return useQuery({
    queryKey: ['commission-entries', 'all'],
    queryFn: async (): Promise<CommissionEntryRow[]> => {
      const { data, error } = await supabase
        .from('commission_entries')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function orderTotal(
  order: OrderWithLines,
  key: 'advice_price' | 'sale_price' = 'sale_price',
) {
  return order.order_lines.reduce((sum, line) => sum + Number(line[key]), 0);
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

/** De laatste n maanden als 'YYYY-MM', oudste eerst. */
export function lastMonths(count: number) {
  const months: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    );
  }
  return months;
}

export type DashboardStats = {
  revenueYear: number;
  revenueSeries: number[];
  revenueDeltaPct: number | null;
  commissionPaid: number;
  commissionSeries: number[];
  activeArchitects: number;
  activitySeries: number[];
  activitiesLast30: number;
  pendingOrders: OrderWithLines[];
  paidOrders: OrderWithLines[];
};

/**
 * Alles wat het dashboard toont, afgeleid uit data die de gebruiker toch al
 * mag zien. RLS bepaalt de scope, dus dezelfde code werkt voor Koreman en
 * voor een agent; met agentId erbij wordt er op één agent gefilterd.
 */
export function useDashboardStats(agentId?: string): {
  stats: DashboardStats;
  isLoading: boolean;
} {
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: architects = [], isLoading: architectsLoading } = useArchitects();
  const { data: activities = [], isLoading: activitiesLoading } =
    useRecentActivities();
  const { data: entries = [], isLoading: entriesLoading } = useAllCommissionEntries();

  const stats = useMemo<DashboardStats>(() => {
    const scopedOrders = agentId
      ? orders.filter((order) => order.agent_id === agentId)
      : orders;
    const scopedArchitects = agentId
      ? architects.filter((architect) => architect.agent_id === agentId)
      : architects;
    const scopedActivities = agentId
      ? activities.filter((activity) => activity.agent_id === agentId)
      : activities;
    const scopedEntries = agentId
      ? entries.filter((entry) => entry.agent_id === agentId)
      : entries;

    const months = lastMonths(12);
    const paidOrders = scopedOrders.filter((order) => order.status === 'betaald');

    const revenueByMonth = new Map<string, number>();
    for (const order of paidOrders) {
      const key = monthKey(order.order_date);
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + orderTotal(order));
    }
    const revenueSeries = months.map((month) => revenueByMonth.get(month) ?? 0);

    // Koreman is alleen de 'koreman'-regels verschuldigd; het deel van de
    // subagent komt van de hoofdagent en telt hier niet mee.
    const commissionByMonth = new Map<string, number>();
    for (const entry of scopedEntries) {
      if (agentId === undefined && entry.payable_by !== 'koreman') continue;
      const key = monthKey(entry.created_at);
      commissionByMonth.set(
        key,
        (commissionByMonth.get(key) ?? 0) + Number(entry.amount),
      );
    }
    const commissionSeries = months.map((month) => commissionByMonth.get(month) ?? 0);

    const activityByMonth = new Map<string, number>();
    for (const activity of scopedActivities) {
      const key = monthKey(activity.activity_date);
      activityByMonth.set(key, (activityByMonth.get(key) ?? 0) + 1);
    }
    const activitySeries = months.map((month) => activityByMonth.get(month) ?? 0);

    const thisMonth = revenueSeries[revenueSeries.length - 1] ?? 0;
    const previousMonth = revenueSeries[revenueSeries.length - 2] ?? 0;
    const revenueDeltaPct =
      previousMonth > 0
        ? ((thisMonth - previousMonth) / previousMonth) * 100
        : null;

    const cutoff = Date.now() - 30 * 86_400_000;

    return {
      revenueYear: revenueSeries.reduce((sum, value) => sum + value, 0),
      revenueSeries,
      revenueDeltaPct,
      commissionPaid: commissionSeries.reduce((sum, value) => sum + value, 0),
      commissionSeries,
      activeArchitects: scopedArchitects.filter(
        (architect) =>
          architect.status === 'actief' || architect.status === 'klant',
      ).length,
      activitySeries,
      activitiesLast30: scopedActivities.filter(
        (activity) => Date.parse(activity.activity_date) >= cutoff,
      ).length,
      pendingOrders: scopedOrders.filter((order) => order.status === 'ingediend'),
      paidOrders,
    };
  }, [orders, architects, activities, entries, agentId]);

  return {
    stats,
    isLoading:
      ordersLoading || architectsLoading || activitiesLoading || entriesLoading,
  };
}
