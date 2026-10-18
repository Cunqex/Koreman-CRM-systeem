import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import { useOrders } from '@/features/orders/queries';
import type { OrderWithLines } from '@/features/architects/queries';
import { formatDate, money } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import { OrderStatusBadge } from '@/features/shared/badges';
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  Tabs,
  type Column,
} from '@/components/ui';

function lineTotal(order: OrderWithLines, key: 'advice_price' | 'sale_price') {
  return order.order_lines.reduce((sum, line) => sum + Number(line[key]), 0);
}

export function OrdersPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const navigate = useNavigate();
  const { isAdmin } = useSession();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading, error } = useOrders();
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

  const pending = orders.filter((order) => order.status === 'ingediend');
  const rows = tab === 'pending' ? pending : orders;

  function architectLabel(order: OrderWithLines) {
    const architect = architectById.get(order.architect_id);
    return architect ? `${architect.first_name} ${architect.last_name}` : '—';
  }

  const columns: Column<OrderWithLines>[] = [
    {
      key: 'reference',
      header: t('order.reference'),
      sortValue: (row) => row.reference ?? row.id,
      cell: (row) => (
        <Link
          to={`/orders/${row.id}`}
          className="font-medium text-navy-900 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.reference ?? row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'architect',
      header: t('architect.one'),
      sortValue: (row) => architectLabel(row),
      cell: (row) => architectLabel(row),
    },
    ...(isAdmin
      ? [
          {
            key: 'agent',
            header: t('roles.agent'),
            sortValue: (row: OrderWithLines) => agentName.get(row.agent_id) ?? '',
            cell: (row: OrderWithLines) => agentName.get(row.agent_id) ?? '—',
          },
        ]
      : []),
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
      sortValue: (row) => lineTotal(row, 'advice_price'),
      cell: (row) => money(lineTotal(row, 'advice_price')),
    },
    {
      key: 'sale',
      header: t('order.saleTotal'),
      align: 'right',
      sortValue: (row) => lineTotal(row, 'sale_price'),
      cell: (row) => money(lineTotal(row, 'sale_price')),
    },
    {
      key: 'discount',
      header: t('order.discount'),
      align: 'right',
      sortValue: (row) =>
        Math.max(0, lineTotal(row, 'advice_price') - lineTotal(row, 'sale_price')),
      cell: (row) => {
        const discount = Math.max(
          0,
          lineTotal(row, 'advice_price') - lineTotal(row, 'sale_price'),
        );
        return discount > 0 ? (
          <span className="text-status-amberfg">{money(discount)}</span>
        ) : (
          <span className="text-navy-300">—</span>
        );
      },
    },
    {
      key: 'status',
      header: t('order.status'),
      sortValue: (row) => row.status,
      cell: (row) => <OrderStatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('order.other')}
        description={t('common.exclVat')}
        search={{ value: search, onChange: setSearch }}
        action={
          isAdmin ? null : (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/orders/nieuw')}
            >
              {t('order.newTitle')}
            </Button>
          )
        }
        tabs={
          <Tabs
            items={[
              { key: 'all', label: t('common.all'), count: orders.length },
              {
                key: 'pending',
                label: t('order.approvalQueue'),
                count: pending.length,
              },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          search={search}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          initialSort={{ key: 'date', dir: 'desc' }}
          emptyTitle={t('order.other')}
        />
      </Card>
    </>
  );
}
