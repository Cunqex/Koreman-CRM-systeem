import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import {
  orderTotal,
  useDashboardStats,
  useInactiveArchitects,
  useRecentActivities,
} from '@/features/dashboard/queries';
import { formatDate, money, moneyCompact, number, relativeTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import { OrderStatusBadge } from '@/features/shared/badges';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  KpiCard,
  PageHeader,
  Tabs,
  Timeline,
  type Column,
  type TimelineEntry,
} from '@/components/ui';

export function DashboardPage() {
  const { isAdmin } = useSession();
  return isAdmin ? <AdminDashboard /> : <AgentDashboard />;
}

/* ========================================================================
 * Koreman
 * ===================================================================== */
function AdminDashboard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('total');

  const { data: profiles = [] } = useProfiles();
  const agents = useMemo(
    () => profiles.filter((profile) => profile.role !== 'admin' && profile.is_active),
    [profiles],
  );

  const scopedAgentId = tab === 'total' ? undefined : tab;
  const { stats, isLoading } = useDashboardStats(scopedAgentId);

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        tabs={
          <Tabs
            items={[
              { key: 'total', label: t('dashboard.tabTotal') },
              ...agents.map((agent) => ({ key: agent.id, label: agent.full_name })),
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label={t('dashboard.kpiRevenue')}
          value={moneyCompact(stats.revenueYear)}
          series={stats.revenueSeries}
          tone="purple"
          deltaPct={stats.revenueDeltaPct}
          deltaLabel={t('common.perContractYear')}
          loading={isLoading}
        />
        <KpiCard
          label={t('dashboard.kpiCommissionPaid')}
          value={moneyCompact(stats.commissionPaid)}
          series={stats.commissionSeries}
          tone="blue"
          hint={t('payableBy.koreman')}
          loading={isLoading}
        />
        <KpiCard
          label={t('dashboard.kpiActiveArchitects')}
          value={number(stats.activeArchitects)}
          tone="green"
          loading={isLoading}
        />
        <KpiCard
          label={t('dashboard.kpiActivities30')}
          value={number(stats.activitiesLast30)}
          series={stats.activitySeries}
          tone="green"
          loading={isLoading}
        />
        <KpiCard
          label={t('dashboard.kpiPendingOrders')}
          value={number(stats.pendingOrders.length)}
          tone="purple"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PendingOrdersCard agentId={scopedAgentId} />
        <InactiveArchitectsCard agentId={scopedAgentId} />
      </div>

      {tab === 'total' ? (
        <Card className="mt-4">
          <CardHeader title={t('dashboard.agentRecap')} />
          <AgentRecapTable />
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader title={t('dashboard.activityLog')} />
        <ActivityLogTimeline agentId={scopedAgentId} />
      </Card>
    </>
  );
}

/* ========================================================================
 * Agent en subagent
 * ===================================================================== */
function AgentDashboard() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { profile } = useSession();
  const { stats, isLoading } = useDashboardStats();
  const { data: architects = [] } = useArchitects();
  const { data: activities = [] } = useRecentActivities();

  const todayKey = new Date().toISOString().slice(0, 10);
  const followUps = activities
    .filter((activity) => activity.follow_up_date && !activity.follow_up_done)
    .sort((a, b) => (a.follow_up_date! < b.follow_up_date! ? -1 : 1));

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  const recentArchitects = useMemo(
    () =>
      [...architects]
        .filter((architect) => architect.last_activity_at)
        .sort((a, b) =>
          (a.last_activity_at ?? '') < (b.last_activity_at ?? '') ? 1 : -1,
        )
        .slice(0, 8),
    [architects],
  );

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={profile?.full_name} />

      {/* Bewust geen targetvisualisatie op het dashboard van de agent. */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.kpiRevenue')}
          value={moneyCompact(stats.revenueYear)}
          series={stats.revenueSeries}
          tone="purple"
          loading={isLoading}
        />
        <KpiCard
          label={t('dashboard.kpiCommissionPaid')}
          value={moneyCompact(stats.commissionPaid)}
          series={stats.commissionSeries}
          tone="blue"
          loading={isLoading}
        />
        <KpiCard
          label={t('dashboard.kpiActivities30')}
          value={number(stats.activitiesLast30)}
          series={stats.activitySeries}
          tone="green"
          loading={isLoading}
        />
        <KpiCard
          label={t('dashboard.kpiActiveArchitects')}
          value={number(stats.activeArchitects)}
          tone="green"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={t('activity.openFollowUps')} />
          <CardBody>
            {followUps.length === 0 ? (
              <EmptyState title={t('activity.openFollowUps')} />
            ) : (
              <ul className="divide-y divide-line">
                {followUps.slice(0, 10).map((activity) => {
                  const overdue = activity.follow_up_date! <= todayKey;
                  const architect = architectById.get(activity.architect_id);
                  return (
                    <li
                      key={activity.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/architecten/${activity.architect_id}`}
                          className="text-sm font-medium text-navy-900 hover:underline"
                        >
                          {architect
                            ? `${architect.first_name} ${architect.last_name}`
                            : '—'}
                        </Link>
                        <p className="truncate text-xs text-navy-400">
                          {activity.follow_up_note ?? activity.subject}
                        </p>
                      </div>
                      <Badge tone={overdue ? 'red' : 'purple'}>
                        {formatDate(activity.follow_up_date, lang)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.myArchitectsRecent')} />
          <CardBody>
            {recentArchitects.length === 0 ? (
              <EmptyState title={t('nav.myArchitects')} />
            ) : (
              <ul className="divide-y divide-line">
                {recentArchitects.map((architect) => (
                  <li
                    key={architect.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/architecten/${architect.id}`}
                        className="text-sm font-medium text-navy-900 hover:underline"
                      >
                        {architect.first_name} {architect.last_name}
                      </Link>
                      <p className="truncate text-xs text-navy-400">
                        {architect.company_name ?? architect.city ?? ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-navy-400">
                      {relativeTime(architect.last_activity_at, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={t('dashboard.myOrders')} />
        <MyOrdersTable />
      </Card>
    </>
  );
}

/* ========================================================================
 * Gedeelde onderdelen
 * ===================================================================== */
function PendingOrdersCard({ agentId }: { agentId?: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { stats, isLoading } = useDashboardStats(agentId);
  const { data: architects = [] } = useArchitects();

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  return (
    <Card>
      <CardHeader title={t('dashboard.pendingOrders')} />
      <CardBody>
        {isLoading ? null : stats.pendingOrders.length === 0 ? (
          <EmptyState title={t('order.approvalQueue')} />
        ) : (
          <ul className="divide-y divide-line">
            {stats.pendingOrders.slice(0, 8).map((order) => {
              const architect = architectById.get(order.architect_id);
              return (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/orders/${order.id}`}
                      className="text-sm font-medium text-navy-900 hover:underline"
                    >
                      {order.reference ?? order.id.slice(0, 8)}
                    </Link>
                    <p className="truncate text-xs text-navy-400">
                      {architect
                        ? `${architect.first_name} ${architect.last_name}`
                        : ''}{' '}
                      · {formatDate(order.order_date, lang)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {money(orderTotal(order))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function InactiveArchitectsCard({ agentId }: { agentId?: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: rows = [], isLoading } = useInactiveArchitects();

  const scoped = agentId ? rows.filter((row) => row.agent_id === agentId) : rows;

  return (
    <Card>
      <CardHeader
        title={t('dashboard.inactiveArchitects')}
        description={t('dashboard.inactiveArchitectsHint', {
          days: scoped[0]?.inactivity_days ?? 60,
        })}
      />
      <CardBody>
        {isLoading ? null : scoped.length === 0 ? (
          <EmptyState title={t('dashboard.inactiveArchitects')} />
        ) : (
          <ul className="divide-y divide-line">
            {scoped.slice(0, 8).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    to={`/architecten/${row.id}`}
                    className="text-sm font-medium text-navy-900 hover:underline"
                  >
                    {row.first_name} {row.last_name}
                  </Link>
                  <p className="truncate text-xs text-navy-400">
                    {row.company_name ?? ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-status-redfg">
                  {row.last_activity_at
                    ? relativeTime(row.last_activity_at, lang)
                    : t('common.none')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ActivityLogTimeline({ agentId }: { agentId?: string }) {
  const { t } = useTranslation();
  const { data: activities = [] } = useRecentActivities(60);
  const { data: architects = [] } = useArchitects();
  const { data: profiles = [] } = useProfiles();

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );
  const agentName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const entries: TimelineEntry[] = useMemo(() => {
    const scoped = agentId
      ? activities.filter((activity) => activity.agent_id === agentId)
      : activities;

    return scoped.slice(0, 30).map((activity) => {
      const architect = architectById.get(activity.architect_id);
      return {
        id: activity.id,
        at: activity.created_at,
        subject: architect
          ? `${architect.first_name} ${architect.last_name}`
          : undefined,
        title: activity.subject,
        actor: agentName.get(activity.agent_id) ?? null,
        badges: <Badge tone="blue">{t(`activityType.${activity.type}`)}</Badge>,
      };
    });
  }, [activities, agentId, architectById, agentName, t]);

  return <Timeline entries={entries} emptyTitle={t('common.emptyTimeline')} />;
}

function AgentRecapTable() {
  const { t } = useTranslation();
  const { data: profiles = [] } = useProfiles();
  const { data: architects = [] } = useArchitects();
  const { data: activities = [] } = useRecentActivities();
  const { stats } = useDashboardStats();

  type Recap = {
    id: string;
    name: string;
    role: string;
    architects: number;
    activities: number;
    revenue: number;
  };

  const rows = useMemo<Recap[]>(() => {
    const agents = profiles.filter((profile) => profile.role !== 'admin');
    return agents.map((agent) => ({
      id: agent.id,
      name: agent.full_name,
      role: agent.role,
      architects: architects.filter((a) => a.agent_id === agent.id).length,
      activities: activities.filter((a) => a.agent_id === agent.id).length,
      revenue: stats.paidOrders
        .filter((order) => order.agent_id === agent.id)
        .reduce((sum, order) => sum + orderTotal(order), 0),
    }));
  }, [profiles, architects, activities, stats.paidOrders]);

  const columns: Column<Recap>[] = [
    {
      key: 'name',
      header: t('roles.agent'),
      sortValue: (row) => row.name,
      cell: (row) => (
        <Link
          to={`/agenten/${row.id}`}
          className="font-medium text-navy-900 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'role',
      header: t('users.role'),
      sortValue: (row) => row.role,
      cell: (row) => t(`roles.${row.role}`),
    },
    {
      key: 'architects',
      header: t('architect.other'),
      align: 'right',
      sortValue: (row) => row.architects,
      cell: (row) => number(row.architects),
    },
    {
      key: 'activities',
      header: t('activity.other'),
      align: 'right',
      sortValue: (row) => row.activities,
      cell: (row) => number(row.activities),
    },
    {
      key: 'revenue',
      header: t('dashboard.kpiRevenue'),
      align: 'right',
      sortValue: (row) => row.revenue,
      cell: (row) => money(row.revenue),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort={{ key: 'revenue', dir: 'desc' }}
      emptyTitle={t('nav.agents')}
    />
  );
}

function MyOrdersTable() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { stats, isLoading } = useDashboardStats();
  const { data: architects = [] } = useArchitects();

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  const rows = useMemo(
    () => [...stats.pendingOrders, ...stats.paidOrders].slice(0, 20),
    [stats.pendingOrders, stats.paidOrders],
  );

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'reference',
      header: t('order.reference'),
      sortValue: (row) => row.reference ?? row.id,
      cell: (row) => (
        <Link
          to={`/orders/${row.id}`}
          className="font-medium text-navy-900 hover:underline"
        >
          {row.reference ?? row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'architect',
      header: t('architect.one'),
      sortValue: (row) => {
        const architect = architectById.get(row.architect_id);
        return architect ? `${architect.last_name}` : '';
      },
      cell: (row) => {
        const architect = architectById.get(row.architect_id);
        return architect ? `${architect.first_name} ${architect.last_name}` : '—';
      },
    },
    {
      key: 'date',
      header: t('order.orderDate'),
      sortValue: (row) => row.order_date,
      cell: (row) => formatDate(row.order_date, lang),
    },
    {
      key: 'total',
      header: t('order.saleTotal'),
      align: 'right',
      sortValue: (row) => orderTotal(row),
      cell: (row) => money(orderTotal(row)),
    },
    {
      key: 'status',
      header: t('order.status'),
      sortValue: (row) => row.status,
      cell: (row) => <OrderStatusBadge status={row.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={isLoading}
      initialSort={{ key: 'date', dir: 'desc' }}
      emptyTitle={t('order.other')}
    />
  );
}

