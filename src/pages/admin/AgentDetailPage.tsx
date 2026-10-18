import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import { useContracts, useContractRegions } from '@/features/contracts/queries';
import { TargetTable } from '@/features/contracts/TargetTable';
import {
  orderTotal,
  useAllCommissionEntries,
  useDashboardStats,
  useRecentActivities,
} from '@/features/dashboard/queries';
import { useOrders } from '@/features/orders/queries';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatDateTime, money, moneyCompact, number, percent } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import {
  ArchitectStatusBadge,
  CommissionKindBadge,
  OrderStatusBadge,
  OriginBadge,
  ProjectStatusBadge,
  RegionBadge,
} from '@/features/shared/badges';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  ErrorState,
  KpiCard,
  PageHeader,
  Tabs,
  type Column,
} from '@/components/ui';

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const [tab, setTab] = useState('overview');

  const { data: profiles = [], isLoading } = useProfiles();
  const agent = profiles.find((profile) => profile.id === agentId) ?? null;
  const { stats } = useDashboardStats(agentId);

  const { data: contracts = [] } = useContracts();
  const contract = useMemo(
    () =>
      contracts
        .filter((item) => item.agent_id === agentId)
        .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0] ?? null,
    [contracts, agentId],
  );

  if (isLoading) return null;

  if (!agent) {
    return (
      <Card>
        <CardBody>
          <ErrorState
            title={t('errors.notFoundTitle')}
            description={t('errors.notFoundBody')}
          />
        </CardBody>
      </Card>
    );
  }

  const subagents = profiles.filter((p) => p.parent_agent_id === agent.id);

  const tabs = [
    { key: 'overview', label: t('common.details') },
    { key: 'architects', label: t('architect.other') },
    { key: 'activities', label: t('activity.other') },
    { key: 'projects', label: t('project.other') },
    { key: 'orders', label: t('order.other') },
    { key: 'commission', label: t('commission.one') },
    { key: 'contract', label: t('contract.one') },
    { key: 'claims', label: t('claimAction.title') },
  ];

  return (
    <>
      <PageHeader
        title={agent.full_name}
        description={agent.company_name ?? agent.email}
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <Badge tone={agent.role === 'agent' ? 'blue' : 'purple'}>
            {t(`roles.${agent.role}`)}
          </Badge>
          {agent.is_active ? null : (
            <Badge tone="red">{t('users.deactivate')}</Badge>
          )}
          {agent.parent_agent_id ? (
            <Link
              to={`/agenten/${agent.parent_agent_id}`}
              className="text-sm text-accent-blue hover:underline"
            >
              {t('users.parentAgent')}
            </Link>
          ) : null}
          {subagents.length > 0 ? (
            <span className="text-sm text-navy-400">
              {t('nav.subagents')}: {subagents.map((s) => s.full_name).join(', ')}
            </span>
          ) : null}
        </CardBody>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.kpiRevenue')}
          value={moneyCompact(stats.revenueYear)}
          series={stats.revenueSeries}
          tone="purple"
        />
        <KpiCard
          label={t('dashboard.kpiCommissionPaid')}
          value={moneyCompact(stats.commissionPaid)}
          series={stats.commissionSeries}
          tone="blue"
        />
        <KpiCard
          label={t('dashboard.kpiActiveArchitects')}
          value={number(stats.activeArchitects)}
          tone="green"
        />
        <KpiCard
          label={t('dashboard.kpiActivities30')}
          value={number(stats.activitiesLast30)}
          series={stats.activitySeries}
          tone="green"
        />
      </div>

      <Tabs items={tabs} active={tab} onChange={setTab} className="mb-4" />

      <Card>
        {tab === 'overview' ? (
          <OverviewTab agentId={agent.id} />
        ) : null}
        {tab === 'architects' ? <AgentArchitects agentId={agent.id} /> : null}
        {tab === 'activities' ? <AgentActivities agentId={agent.id} /> : null}
        {tab === 'projects' ? <AgentProjects agentId={agent.id} /> : null}
        {tab === 'orders' ? <AgentOrders agentId={agent.id} /> : null}
        {tab === 'commission' ? <AgentCommission agentId={agent.id} /> : null}
        {tab === 'contract' ? (
          contract ? (
            <>
              <CardHeader
                title={t('contract.one')}
                description={`${formatDate(contract.start_date, lang)} — ${
                  contract.end_date ? formatDate(contract.end_date, lang) : '…'
                }`}
                action={
                  <Link
                    to={`/contracten/${contract.id}`}
                    className="text-sm font-medium text-accent-blue hover:underline"
                  >
                    {t('common.edit')}
                  </Link>
                }
              />
              <ContractSummary contractId={contract.id} />
              <TargetTable contractId={contract.id} />
            </>
          ) : (
            <CardBody>
              <ErrorState title={t('contract.one')} description={t('common.none')} />
            </CardBody>
          )
        ) : null}
        {tab === 'claims' ? <AgentClaims agentId={agent.id} /> : null}
      </Card>
    </>
  );
}

function OverviewTab({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const { stats } = useDashboardStats(agentId);
  const { data: architects = [] } = useArchitects();

  const scoped = architects.filter((a) => a.agent_id === agentId);
  const byStatus = (['lead', 'actief', 'klant', 'inactief'] as const).map(
    (status) => ({
      status,
      count: scoped.filter((a) => a.status === status).length,
    }),
  );

  return (
    <CardBody className="grid gap-6 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-semibold text-navy-700">
          {t('performance.pipeline')}
        </p>
        <ul className="space-y-1.5">
          {byStatus.map(({ status, count }) => (
            <li key={status} className="flex items-center justify-between gap-3">
              <ArchitectStatusBadge status={status} />
              <span className="tabular-nums text-navy-800">{number(count)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-navy-700">
          {t('order.other')}
        </p>
        <ul className="space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-navy-400">{t('order.approvalQueue')}</span>
            <span className="tabular-nums">{number(stats.pendingOrders.length)}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-navy-400">{t('orderStatus.betaald')}</span>
            <span className="tabular-nums">{number(stats.paidOrders.length)}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-navy-400">{t('dashboard.kpiRevenue')}</span>
            <span className="tabular-nums">{money(stats.revenueYear)}</span>
          </li>
        </ul>
      </div>
    </CardBody>
  );
}

function AgentArchitects({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const { data: architects = [], isLoading } = useArchitects();
  const rows = architects.filter((a) => a.agent_id === agentId);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: t('architect.one'),
      sortValue: (row) => `${row.last_name} ${row.first_name}`,
      cell: (row) => (
        <Link
          to={`/architecten/${row.id}`}
          className="font-medium text-navy-900 hover:underline"
        >
          {row.first_name} {row.last_name}
        </Link>
      ),
    },
    {
      key: 'city',
      header: t('architect.city'),
      sortValue: (row) => row.city ?? '',
      cell: (row) => row.city ?? '—',
    },
    {
      key: 'status',
      header: t('architect.status'),
      sortValue: (row) => row.status,
      cell: (row) => <ArchitectStatusBadge status={row.status} />,
    },
    {
      key: 'origin',
      header: t('architect.origin'),
      sortValue: (row) => row.origin,
      cell: (row) => <OriginBadge origin={row.origin} />,
    },
    {
      key: 'region',
      header: t('architect.inRegion'),
      sortValue: (row) => (row.in_region ? 1 : 0),
      cell: (row) => (
        <RegionBadge inRegion={row.in_region} override={row.region_override} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={isLoading}
      emptyTitle={t('architect.other')}
    />
  );
}

function AgentActivities({ agentId }: { agentId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: activities = [], isLoading } = useRecentActivities();
  const { data: architects = [] } = useArchitects();

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );
  const rows = activities.filter((a) => a.agent_id === agentId);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'date',
      header: t('activity.date'),
      sortValue: (row) => row.activity_date,
      cell: (row) => formatDate(row.activity_date, lang),
    },
    {
      key: 'architect',
      header: t('architect.one'),
      sortValue: (row) => architectById.get(row.architect_id)?.last_name ?? '',
      cell: (row) => {
        const architect = architectById.get(row.architect_id);
        return architect ? (
          <Link
            to={`/architecten/${architect.id}`}
            className="hover:underline"
          >
            {architect.first_name} {architect.last_name}
          </Link>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'type',
      header: t('activity.type'),
      sortValue: (row) => row.type,
      cell: (row) => <Badge tone="blue">{t(`activityType.${row.type}`)}</Badge>,
    },
    {
      key: 'subject',
      header: t('activity.subject'),
      sortValue: (row) => row.subject,
      cell: (row) => row.subject,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={isLoading}
      initialSort={{ key: 'date', dir: 'desc' }}
      emptyTitle={t('activity.other')}
    />
  );
}

function AgentProjects({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const { data: architects = [] } = useArchitects();

  const architectIds = architects
    .filter((a) => a.agent_id === agentId)
    .map((a) => a.id);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', 'agent', agentId, architectIds.length],
    enabled: architectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('architect_id', architectIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  const columns: Column<(typeof projects)[number]>[] = [
    {
      key: 'name',
      header: t('project.name'),
      sortValue: (row) => row.name,
      cell: (row) => <span className="font-medium text-navy-900">{row.name}</span>,
    },
    {
      key: 'architect',
      header: t('architect.one'),
      sortValue: (row) => architectById.get(row.architect_id)?.last_name ?? '',
      cell: (row) => {
        const architect = architectById.get(row.architect_id);
        return architect ? `${architect.first_name} ${architect.last_name}` : '—';
      },
    },
    {
      key: 'city',
      header: t('project.city'),
      sortValue: (row) => row.city ?? '',
      cell: (row) => row.city ?? '—',
    },
    {
      key: 'status',
      header: t('project.status'),
      sortValue: (row) => row.status,
      cell: (row) => <ProjectStatusBadge status={row.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={projects}
      rowKey={(row) => row.id}
      loading={isLoading}
      emptyTitle={t('project.other')}
    />
  );
}

function AgentOrders({ agentId }: { agentId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: orders = [], isLoading } = useOrders();
  const rows = orders.filter((order) => order.agent_id === agentId);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'reference',
      header: t('order.reference'),
      sortValue: (row) => row.reference ?? row.id,
      cell: (row) => (
        <Link to={`/orders/${row.id}`} className="font-medium hover:underline">
          {row.reference ?? row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'date',
      header: t('order.orderDate'),
      sortValue: (row) => row.order_date,
      cell: (row) => formatDate(row.order_date, lang),
    },
    {
      key: 'advice',
      header: t('order.adviceTotal'),
      align: 'right',
      sortValue: (row) => orderTotal(row, 'advice_price'),
      cell: (row) => money(orderTotal(row, 'advice_price')),
    },
    {
      key: 'sale',
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

function AgentCommission({ agentId }: { agentId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: entries = [], isLoading } = useAllCommissionEntries();
  const rows = entries.filter((entry) => entry.agent_id === agentId);

  const total = rows
    .filter((entry) => entry.payable_by === 'koreman')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'date',
      header: t('common.date'),
      sortValue: (row) => row.created_at,
      cell: (row) => formatDate(row.created_at, lang),
    },
    {
      key: 'kind',
      header: t('commission.kind'),
      sortValue: (row) => row.kind,
      cell: (row) => <CommissionKindBadge kind={row.kind} />,
    },
    {
      key: 'payable',
      header: t('commission.payableBy'),
      sortValue: (row) => row.payable_by,
      cell: (row) => t(`payableBy.${row.payable_by}`),
    },
    {
      key: 'year',
      header: t('contract.contractYear'),
      align: 'right',
      sortValue: (row) => row.contract_year ?? 0,
      cell: (row) => row.contract_year ?? '—',
    },
    {
      key: 'amount',
      header: t('commission.amount'),
      align: 'right',
      sortValue: (row) => Number(row.amount),
      cell: (row) => (
        <span className={Number(row.amount) < 0 ? 'text-status-redfg' : ''}>
          {money(row.amount)}
        </span>
      ),
    },
  ];

  return (
    <>
      <CardHeader
        title={t('commission.ledger')}
        action={
          <span className="text-sm text-navy-500">
            {t('payableBy.koreman')}:{' '}
            <span className="font-semibold text-navy-900">{money(total)}</span>
          </span>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={isLoading}
        initialSort={{ key: 'date', dir: 'desc' }}
        emptyTitle={t('commission.ledger')}
      />
    </>
  );
}

function ContractSummary({ contractId }: { contractId: string }) {
  const { t } = useTranslation();
  const { data: contracts = [] } = useContracts();
  const { data: regions = [] } = useContractRegions(contractId);
  const contract = contracts.find((item) => item.id === contractId);

  if (!contract) return null;

  return (
    <CardBody className="grid gap-4 sm:grid-cols-2">
      <dl className="space-y-2 text-sm">
        <Pair
          label={t('contract.ownCommissionPct')}
          value={percent(contract.own_commission_pct)}
        />
        <Pair
          label={t('contract.transferredCommissionPct')}
          value={percent(contract.transferred_commission_pct)}
        />
        <Pair
          label={t('contract.priceTolerancePct')}
          value={percent(contract.price_tolerance_pct)}
        />
        <Pair
          label={t('contract.inactivityDays')}
          value={String(contract.inactivity_days)}
        />
        <Pair
          label={t('contract.clawbackEnabled')}
          value={contract.clawback_enabled ? t('common.yes') : t('common.no')}
        />
      </dl>
      <div>
        <p className="mb-2 text-sm font-semibold text-navy-700">
          {t('contract.regions')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {regions.length === 0 ? (
            <span className="text-sm text-navy-400">{t('common.none')}</span>
          ) : (
            regions.map((region) => (
              <Badge key={region.id} tone="blue">
                {t(`province.${region.province}`)}
              </Badge>
            ))
          )}
        </div>
        {contract.region_claim_active ? null : (
          <Badge tone="red" className="mt-2">
            {t('contract.revokeRegion')}
          </Badge>
        )}
      </div>
    </CardBody>
  );
}

function AgentClaims({ agentId }: { agentId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: architects = [] } = useArchitects();

  const architectIds = architects
    .filter((a) => a.agent_id === agentId)
    .map((a) => a.id);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['claims', 'agent', agentId, architectIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_actions')
        .select('*')
        .order('performed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  const rows = claims.filter(
    (claim) =>
      (claim.architect_id && architectIds.includes(claim.architect_id)) ||
      claim.new_agent_id === agentId,
  );

  if (isLoading) return <CardBody>{t('common.loading')}</CardBody>;

  return (
    <CardBody>
      {rows.length === 0 ? (
        <p className="text-sm text-navy-400">{t('common.none')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((claim) => {
            const architect = claim.architect_id
              ? architectById.get(claim.architect_id)
              : null;
            return (
              <li key={claim.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">{t(`claimAction.${claim.action}`)}</Badge>
                  {architect ? (
                    <Link
                      to={`/architecten/${architect.id}`}
                      className="text-sm font-medium text-navy-900 hover:underline"
                    >
                      {architect.first_name} {architect.last_name}
                    </Link>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-navy-500">{claim.reason}</p>
                <p className="mt-1 text-xs text-navy-400">
                  {formatDateTime(claim.performed_at, lang)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </CardBody>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-navy-400">{label}</dt>
      <dd className="font-medium tabular-nums text-navy-800">{value}</dd>
    </div>
  );
}
