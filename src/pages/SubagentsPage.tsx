import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import {
  orderTotal,
  useAllCommissionEntries,
  useRecentActivities,
} from '@/features/dashboard/queries';
import { useOrders } from '@/features/orders/queries';
import { useSession } from '@/features/auth/SessionProvider';
import { formatDate, money, number } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import { ArchitectStatusBadge, OrderStatusBadge } from '@/features/shared/badges';
import {
  Alert,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Tabs,
  type Column,
} from '@/components/ui';

/**
 * Inzage van een hoofdagent in de data van zijn subagenten. Alleen lezen:
 * RLS staat een hoofdagent geen wijzigingen toe op rijen van een subagent.
 */
export function SubagentsPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { profile } = useSession();
  const [tab, setTab] = useState('architects');

  const { data: profiles = [] } = useProfiles();
  const { data: architects = [] } = useArchitects();
  const { data: activities = [] } = useRecentActivities();
  const { data: orders = [] } = useOrders();
  const { data: entries = [] } = useAllCommissionEntries();

  const subagents = useMemo(
    () => profiles.filter((item) => item.parent_agent_id === profile?.id),
    [profiles, profile?.id],
  );
  const subagentIds = subagents.map((item) => item.id);
  const subagentName = useMemo(
    () => new Map(subagents.map((item) => [item.id, item.full_name])),
    [subagents],
  );
  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  if (subagents.length === 0) {
    return (
      <>
        <PageHeader title={t('nav.subagents')} />
        <Card>
          <EmptyState title={t('nav.subagents')} description={t('common.emptyBody')} />
        </Card>
      </>
    );
  }

  const scopedArchitects = architects.filter((a) => subagentIds.includes(a.agent_id));
  const scopedActivities = activities.filter((a) => subagentIds.includes(a.agent_id));
  const scopedOrders = orders.filter((o) => subagentIds.includes(o.agent_id));
  const scopedEntries = entries.filter((e) => subagentIds.includes(e.agent_id));

  const architectColumns: Column<(typeof scopedArchitects)[number]>[] = [
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
      key: 'subagent',
      header: t('roles.subagent'),
      sortValue: (row) => subagentName.get(row.agent_id) ?? '',
      cell: (row) => subagentName.get(row.agent_id) ?? '—',
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
  ];

  const activityColumns: Column<(typeof scopedActivities)[number]>[] = [
    {
      key: 'date',
      header: t('activity.date'),
      sortValue: (row) => row.activity_date,
      cell: (row) => formatDate(row.activity_date, lang),
    },
    {
      key: 'subagent',
      header: t('roles.subagent'),
      sortValue: (row) => subagentName.get(row.agent_id) ?? '',
      cell: (row) => subagentName.get(row.agent_id) ?? '—',
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
      key: 'type',
      header: t('activity.type'),
      sortValue: (row) => row.type,
      cell: (row) => t(`activityType.${row.type}`),
    },
    {
      key: 'subject',
      header: t('activity.subject'),
      sortValue: (row) => row.subject,
      cell: (row) => row.subject,
    },
  ];

  const orderColumns: Column<(typeof scopedOrders)[number]>[] = [
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
      key: 'subagent',
      header: t('roles.subagent'),
      sortValue: (row) => subagentName.get(row.agent_id) ?? '',
      cell: (row) => subagentName.get(row.agent_id) ?? '—',
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

  const commissionColumns: Column<(typeof scopedEntries)[number]>[] = [
    {
      key: 'date',
      header: t('common.date'),
      sortValue: (row) => row.created_at,
      cell: (row) => formatDate(row.created_at, lang),
    },
    {
      key: 'subagent',
      header: t('roles.subagent'),
      sortValue: (row) => subagentName.get(row.agent_id) ?? '',
      cell: (row) => subagentName.get(row.agent_id) ?? '—',
    },
    {
      key: 'kind',
      header: t('commission.kind'),
      sortValue: (row) => row.kind,
      cell: (row) => t(`commissionKind.${row.kind}`),
    },
    {
      key: 'amount',
      header: t('commission.amount'),
      align: 'right',
      sortValue: (row) => Number(row.amount),
      cell: (row) => money(row.amount),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('nav.subagents')}
        description={subagents.map((item) => item.full_name).join(', ')}
        tabs={
          <Tabs
            items={[
              {
                key: 'architects',
                label: t('architect.other'),
                count: scopedArchitects.length,
              },
              {
                key: 'activities',
                label: t('activity.other'),
                count: scopedActivities.length,
              },
              { key: 'orders', label: t('order.other'), count: scopedOrders.length },
              { key: 'commission', label: t('commission.one') },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      <Alert tone="info" className="mb-4">
        {t('commission.readOnly')}
      </Alert>

      <Card>
        {tab === 'architects' ? (
          <>
            <CardHeader
              title={t('architect.other')}
              action={
                <span className="text-sm text-navy-400">
                  {number(scopedArchitects.length)}
                </span>
              }
            />
            <DataTable
              columns={architectColumns}
              rows={scopedArchitects}
              rowKey={(row) => row.id}
              emptyTitle={t('architect.other')}
            />
          </>
        ) : null}

        {tab === 'activities' ? (
          <DataTable
            columns={activityColumns}
            rows={scopedActivities}
            rowKey={(row) => row.id}
            initialSort={{ key: 'date', dir: 'desc' }}
            emptyTitle={t('activity.other')}
          />
        ) : null}

        {tab === 'orders' ? (
          <DataTable
            columns={orderColumns}
            rows={scopedOrders}
            rowKey={(row) => row.id}
            initialSort={{ key: 'date', dir: 'desc' }}
            emptyTitle={t('order.other')}
          />
        ) : null}

        {tab === 'commission' ? (
          <DataTable
            columns={commissionColumns}
            rows={scopedEntries}
            rowKey={(row) => row.id}
            initialSort={{ key: 'date', dir: 'desc' }}
            emptyTitle={t('commission.ledger')}
          />
        ) : null}
      </Card>
    </>
  );
}
