import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import { useContracts } from '@/features/contracts/queries';
import {
  orderTotal,
  useAllCommissionEntries,
  useRecentActivities,
} from '@/features/dashboard/queries';
import { useOrders } from '@/features/orders/queries';
import { money, number, percent } from '@/lib/format';
import type { ProfileRow } from '@/types/database';
import {
  Badge,
  Card,
  DataTable,
  PageHeader,
  type Column,
} from '@/components/ui';

type AgentRow = ProfileRow & {
  architectCount: number;
  activityCount: number;
  revenue: number;
  commission: number;
  ownPct: number | null;
};

export function AgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: profiles = [], isLoading, error } = useProfiles();
  const { data: architects = [] } = useArchitects();
  const { data: activities = [] } = useRecentActivities();
  const { data: orders = [] } = useOrders();
  const { data: entries = [] } = useAllCommissionEntries();
  const { data: contracts = [] } = useContracts();

  const rows = useMemo<AgentRow[]>(() => {
    const openContract = new Map(
      contracts.filter((c) => !c.end_date).map((c) => [c.agent_id, c]),
    );

    return profiles
      .filter((profile) => profile.role !== 'admin')
      .map((profile) => ({
        ...profile,
        architectCount: architects.filter((a) => a.agent_id === profile.id).length,
        activityCount: activities.filter((a) => a.agent_id === profile.id).length,
        revenue: orders
          .filter(
            (order) => order.agent_id === profile.id && order.status === 'betaald',
          )
          .reduce((sum, order) => sum + orderTotal(order), 0),
        commission: entries
          .filter(
            (entry) => entry.agent_id === profile.id && entry.payable_by === 'koreman',
          )
          .reduce((sum, entry) => sum + Number(entry.amount), 0),
        ownPct: openContract.get(profile.id)?.own_commission_pct ?? null,
      }));
  }, [profiles, architects, activities, orders, entries, contracts]);

  const parentName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const columns: Column<AgentRow>[] = [
    {
      key: 'name',
      header: t('users.fullName'),
      sortValue: (row) => row.full_name,
      cell: (row) => (
        <div>
          <p className="font-medium text-navy-900">{row.full_name}</p>
          <p className="text-xs text-navy-400">
            {row.company_name ?? row.email}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('users.role'),
      sortValue: (row) => row.role,
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <Badge tone={row.role === 'agent' ? 'blue' : 'purple'}>
            {t(`roles.${row.role}`)}
          </Badge>
          {row.parent_agent_id ? (
            <span className="text-xs text-navy-400">
              {parentName.get(row.parent_agent_id)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'architects',
      header: t('architect.other'),
      align: 'right',
      sortValue: (row) => row.architectCount,
      cell: (row) => number(row.architectCount),
    },
    {
      key: 'activities',
      header: t('activity.other'),
      align: 'right',
      sortValue: (row) => row.activityCount,
      cell: (row) => number(row.activityCount),
    },
    {
      key: 'revenue',
      header: t('dashboard.kpiRevenue'),
      align: 'right',
      sortValue: (row) => row.revenue,
      cell: (row) => money(row.revenue),
    },
    {
      key: 'commission',
      header: t('commission.one'),
      align: 'right',
      sortValue: (row) => row.commission,
      cell: (row) => money(row.commission),
    },
    {
      key: 'pct',
      header: t('contract.ownCommissionPct'),
      align: 'right',
      sortValue: (row) => row.ownPct ?? 0,
      cell: (row) =>
        row.ownPct === null ? (
          <span className="text-navy-300">—</span>
        ) : (
          percent(row.ownPct)
        ),
    },
    {
      key: 'active',
      header: t('users.isActive'),
      sortValue: (row) => (row.is_active ? 1 : 0),
      cell: (row) =>
        row.is_active ? null : <Badge tone="red">{t('common.no')}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('nav.agents')}
        search={{ value: search, onChange: setSearch }}
      />
      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          search={search}
          onRowClick={(row) => navigate(`/agenten/${row.id}`)}
          initialSort={{ key: 'revenue', dir: 'desc' }}
          emptyTitle={t('nav.agents')}
        />
      </Card>
    </>
  );
}
