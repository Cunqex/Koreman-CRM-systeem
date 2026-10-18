import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import { useContracts } from '@/features/contracts/queries';
import { TargetTable } from '@/features/contracts/TargetTable';
import { orderTotal, lastMonths, useRecentActivities } from '@/features/dashboard/queries';
import { useOrders } from '@/features/orders/queries';
import { money, moneyCompact, number, percent } from '@/lib/format';
import type { ActivityType, ArchitectStatus } from '@/types/database';
import { ArchitectStatusBadge } from '@/features/shared/badges';
import {
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Select,
  type Column,
} from '@/components/ui';

const ACCENTS = ['#7C5CFC', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444'];

const ACTIVITY_TYPES: ActivityType[] = [
  'telefoon',
  'email',
  'bezoek',
  'meeting',
  'showroomafspraak',
  'stalen',
  'offerte',
  'presentatie',
];

const STATUSES: ArchitectStatus[] = ['lead', 'actief', 'klant', 'inactief'];

function isoWeek(date: Date) {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round(diff / (7 * 86_400_000));
}

export function PerformancePage() {
  const { t } = useTranslation();
  const [agentId, setAgentId] = useState('');

  const { data: profiles = [] } = useProfiles();
  const { data: orders = [] } = useOrders();
  const { data: architects = [] } = useArchitects();
  const { data: activities = [] } = useRecentActivities(1000);
  const { data: contracts = [] } = useContracts();

  const agents = profiles.filter((profile) => profile.role !== 'admin');

  const scopedOrders = agentId
    ? orders.filter((order) => order.agent_id === agentId)
    : orders;
  const scopedArchitects = agentId
    ? architects.filter((architect) => architect.agent_id === agentId)
    : architects;
  const scopedActivities = agentId
    ? activities.filter((activity) => activity.agent_id === agentId)
    : activities;

  const paid = scopedOrders.filter((order) => order.status === 'betaald');
  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  // Omzet per maand, gesplitst in zelf getekend en overgedragen.
  const revenueData = useMemo(() => {
    const months = lastMonths(12);
    return months.map((month) => {
      const inMonth = paid.filter((order) => order.order_date.slice(0, 7) === month);
      const own = inMonth
        .filter(
          (order) => architectById.get(order.architect_id)?.origin === 'agent_signed',
        )
        .reduce((sum, order) => sum + orderTotal(order), 0);
      const transferred = inMonth
        .filter(
          (order) =>
            architectById.get(order.architect_id)?.origin === 'koreman_transferred',
        )
        .reduce((sum, order) => sum + orderTotal(order), 0);
      return { month: month.slice(5), own, transferred };
    });
  }, [paid, architectById]);

  const activityTypeData = useMemo(
    () =>
      ACTIVITY_TYPES.map((type) => ({
        type: t(`activityType.${type}`),
        count: scopedActivities.filter((activity) => activity.type === type).length,
      })).filter((row) => row.count > 0),
    [scopedActivities, t],
  );

  const activityWeekData = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const activity of scopedActivities) {
      const date = new Date(activity.activity_date);
      const key = `${date.getFullYear()}-W${String(isoWeek(date)).padStart(2, '0')}`;
      byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
    }
    return [...byWeek.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-16)
      .map(([week, count]) => ({ week: week.slice(5), count }));
  }, [scopedActivities]);

  const pipelineData = useMemo(
    () =>
      STATUSES.map((status) => ({
        status,
        label: t(`architectStatus.${status}`),
        count: scopedArchitects.filter((a) => a.status === status).length,
      })),
    [scopedArchitects, t],
  );

  const conversion =
    scopedArchitects.length > 0
      ? (scopedArchitects.filter((a) => a.status === 'klant').length /
          scopedArchitects.length) *
        100
      : null;

  // Top-architecten op betaalde omzet.
  const topArchitects = useMemo(() => {
    const byArchitect = new Map<string, number>();
    for (const order of paid) {
      byArchitect.set(
        order.architect_id,
        (byArchitect.get(order.architect_id) ?? 0) + orderTotal(order),
      );
    }
    return [...byArchitect.entries()]
      .map(([id, revenue]) => ({ id, revenue, architect: architectById.get(id) }))
      .filter((row) => row.architect)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [paid, architectById]);

  const contract = contracts
    .filter((item) => !agentId || item.agent_id === agentId)
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0];

  const topColumns: Column<(typeof topArchitects)[number]>[] = [
    {
      key: 'name',
      header: t('architect.one'),
      sortValue: (row) => row.architect!.last_name,
      cell: (row) => (
        <Link
          to={`/architecten/${row.id}`}
          className="font-medium text-navy-900 hover:underline"
        >
          {row.architect!.first_name} {row.architect!.last_name}
        </Link>
      ),
    },
    {
      key: 'status',
      header: t('architect.status'),
      sortValue: (row) => row.architect!.status,
      cell: (row) => <ArchitectStatusBadge status={row.architect!.status} />,
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
    <>
      <PageHeader
        title={t('performance.title')}
        action={
          <Select
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            className="w-56"
            aria-label={t('roles.agent')}
          >
            <option value="">{t('dashboard.tabTotal')}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.full_name}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={t('performance.revenuePerMonth')}
            description={t('performance.ownVsTransferred')}
          />
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid stroke="#E7E9EE" vertical={false} />
                  <XAxis dataKey="month" stroke="#9aa1c2" fontSize={12} />
                  <YAxis
                    stroke="#9aa1c2"
                    fontSize={12}
                    tickFormatter={(value: number) => moneyCompact(value)}
                  />
                  <Tooltip
                    formatter={(value: number) => money(value)}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E7E9EE' }}
                  />
                  <Legend />
                  <Bar
                    dataKey="own"
                    name={t('targetScope.own')}
                    stackId="a"
                    fill={ACCENTS[0]}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="transferred"
                    name={t('targetScope.transferred')}
                    stackId="a"
                    fill={ACCENTS[1]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('performance.activitiesPerWeek')} />
          <CardBody>
            <div className="h-72">
              {activityWeekData.length === 0 ? (
                <EmptyState title={t('activity.other')} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityWeekData}>
                    <CartesianGrid stroke="#E7E9EE" vertical={false} />
                    <XAxis dataKey="week" stroke="#9aa1c2" fontSize={12} />
                    <YAxis stroke="#9aa1c2" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #E7E9EE' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name={t('activity.other')}
                      stroke={ACCENTS[2]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('performance.activitiesPerType')} />
          <CardBody>
            <div className="h-72">
              {activityTypeData.length === 0 ? (
                <EmptyState title={t('activity.other')} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityTypeData} layout="vertical">
                    <CartesianGrid stroke="#E7E9EE" horizontal={false} />
                    <XAxis type="number" stroke="#9aa1c2" fontSize={12} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="type"
                      stroke="#9aa1c2"
                      fontSize={12}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #E7E9EE' }}
                    />
                    <Bar dataKey="count" name={t('activity.other')} radius={[0, 4, 4, 0]}>
                      {activityTypeData.map((_, index) => (
                        <Cell key={index} fill={ACCENTS[index % ACCENTS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('performance.pipeline')}
            description={
              conversion === null
                ? undefined
                : `${t('performance.conversion')}: ${percent(conversion)}`
            }
          />
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData}>
                  <CartesianGrid stroke="#E7E9EE" vertical={false} />
                  <XAxis dataKey="label" stroke="#9aa1c2" fontSize={12} />
                  <YAxis stroke="#9aa1c2" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #E7E9EE' }}
                  />
                  <Bar dataKey="count" name={t('architect.other')} radius={[4, 4, 0, 0]}>
                    {pipelineData.map((_, index) => (
                      <Cell key={index} fill={ACCENTS[index % ACCENTS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={t('performance.topArchitects')} />
        <DataTable
          columns={topColumns}
          rows={topArchitects}
          rowKey={(row) => row.id}
          initialSort={{ key: 'revenue', dir: 'desc' }}
          emptyTitle={t('performance.topArchitects')}
        />
      </Card>

      {contract ? (
        <Card className="mt-4">
          <CardHeader
            title={t('performance.contractYearEvaluation')}
            description={t('common.perContractYear')}
          />
          <TargetTable contractId={contract.id} />
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardBody>
          <p className="text-sm text-navy-400">
            {t('dashboard.inactiveArchitects')}:{' '}
            <span className="font-semibold text-navy-800">
              {number(
                scopedArchitects.filter((architect) => {
                  if (!architect.last_activity_at) return architect.status !== 'inactief';
                  return (
                    Date.now() - Date.parse(architect.last_activity_at) >
                    60 * 86_400_000
                  );
                }).length,
              )}
            </span>
          </p>
        </CardBody>
      </Card>
    </>
  );
}
