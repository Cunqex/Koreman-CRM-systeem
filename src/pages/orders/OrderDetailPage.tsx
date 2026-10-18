import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import {
  useCommissionCalculation,
  useCommissionEntries,
  useCollections,
  useOrder,
} from '@/features/orders/queries';
import { formatDate, formatDateTime, money, percent } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { OrderStatus } from '@/types/database';
import { CommissionKindBadge, OrderStatusBadge } from '@/features/shared/badges';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui';

/** Wat Koreman vanaf deze status mag doen. Moet sporen met fn_orders_status_guard. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ingediend: ['goedgekeurd', 'afgekeurd', 'geannuleerd'],
  afgekeurd: ['ingediend', 'geannuleerd'],
  goedgekeurd: ['betaald', 'afgekeurd', 'geannuleerd'],
  betaald: ['retour', 'geannuleerd'],
  geannuleerd: [],
  retour: [],
};

const ACTION_LABEL: Record<OrderStatus, string> = {
  ingediend: 'order.submit',
  goedgekeurd: 'order.approve',
  afgekeurd: 'order.reject',
  betaald: 'order.markPaid',
  geannuleerd: 'order.cancel',
  retour: 'order.markReturn',
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useSession();

  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: calculation } = useCommissionCalculation(orderId);
  const { data: entries = [] } = useCommissionEntries(orderId);
  const { data: architects = [] } = useArchitects();
  const { data: profiles = [] } = useProfiles();
  const { data: collections = [] } = useCollections();

  const [pending, setPending] = useState<OrderStatus | null>(null);

  const collectionName = useMemo(
    () => new Map(collections.map((c) => [c.id, c.name])),
    [collections],
  );
  const agentName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const changeStatus = useMutation({
    mutationFn: async ({
      status,
      reason,
    }: {
      status: OrderStatus;
      reason?: string;
    }) => {
      // De database zet approved_by, approved_at, paid_at en cancelled_at zelf
      // bij de overgang; de client stuurt alleen de nieuwe status mee.
      const patch: Record<string, unknown> = { status };
      if (status === 'afgekeurd') patch.rejection_reason = reason ?? null;

      const { error: updateError } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', orderId!);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['commission-entries', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['commission-calc', orderId] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
        </CardBody>
      </Card>
    );
  }

  if (error || !order) {
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

  const architect = architects.find((a) => a.id === order.architect_id);
  const adviceTotal = order.order_lines.reduce(
    (sum, line) => sum + Number(line.advice_price),
    0,
  );
  const saleTotal = order.order_lines.reduce(
    (sum, line) => sum + Number(line.sale_price),
    0,
  );
  const discount = Math.max(0, adviceTotal - saleTotal);

  const canAgentEdit = order.status === 'ingediend' && order.agent_id === profile?.id;
  const available = isAdmin ? TRANSITIONS[order.status] : [];

  return (
    <>
      <PageHeader
        title={`${t('order.one')} ${order.reference ?? order.id.slice(0, 8)}`}
        description={
          architect ? `${architect.first_name} ${architect.last_name}` : undefined
        }
        action={
          canAgentEdit ? (
            <Button
              variant="secondary"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => navigate(`/orders/${order.id}/bewerken`)}
            >
              {t('common.edit')}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={order.status} />
                {architect ? (
                  <Link
                    to={`/architecten/${architect.id}`}
                    className="text-sm text-accent-blue hover:underline"
                  >
                    {architect.first_name} {architect.last_name}
                  </Link>
                ) : null}
              </div>

              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Pair label={t('order.orderDate')} value={formatDate(order.order_date, lang)} />
                {isAdmin ? (
                  <Pair
                    label={t('roles.agent')}
                    value={agentName.get(order.agent_id) ?? '—'}
                  />
                ) : null}
                {order.approved_at ? (
                  <Pair
                    label={t('order.approvedBy')}
                    value={`${agentName.get(order.approved_by ?? '') ?? '—'} · ${formatDateTime(order.approved_at, lang)}`}
                  />
                ) : null}
                {order.paid_at ? (
                  <Pair label={t('order.paidAt')} value={formatDateTime(order.paid_at, lang)} />
                ) : null}
              </dl>

              {order.rejection_reason ? (
                <Alert tone="error" title={t('order.rejectionReason')}>
                  {order.rejection_reason}
                </Alert>
              ) : null}

              {order.agent_notes ? (
                <div>
                  <p className="text-xs font-medium text-navy-400">
                    {t('order.agentNotes')}
                  </p>
                  <p className="whitespace-pre-line text-sm text-navy-700">
                    {order.agent_notes}
                  </p>
                </div>
              ) : null}

              {isAdmin && available.length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                  {available.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={
                        status === 'afgekeurd' || status === 'geannuleerd'
                          ? 'danger'
                          : status === 'betaald'
                            ? 'primary'
                            : 'secondary'
                      }
                      onClick={() => setPending(status)}
                    >
                      {t(ACTION_LABEL[status])}
                    </Button>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('order.lines')} description={t('common.exclVat')} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-3 font-semibold text-navy-700">
                      {t('order.collection')}
                    </th>
                    <th className="px-5 py-3 font-semibold text-navy-700">
                      {t('order.designName')}
                    </th>
                    <th className="px-5 py-3 font-semibold text-navy-700">
                      {t('order.shape')}
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-navy-700">
                      {t('order.quantity')}
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-navy-700">
                      {t('order.advicePrice')}
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-navy-700">
                      {t('order.salePrice')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.order_lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-5 py-4">
                        {line.collection_id
                          ? (collectionName.get(line.collection_id) ?? '—')
                          : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-navy-800">
                          {line.design_name ?? '—'}
                        </p>
                        {line.width_cm && line.length_cm ? (
                          <p className="text-xs text-navy-400">
                            {line.width_cm} × {line.length_cm} cm
                          </p>
                        ) : null}
                        {line.custom_edits ? (
                          <p className="mt-1 text-xs text-navy-500">
                            {line.custom_edits}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        {line.shape ? t(`shape.${line.shape}`) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {line.quantity}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {money(line.advice_price)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {money(line.sale_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title={t('commission.one')} />
            <CardBody className="space-y-3 text-sm">
              <Row label={t('order.adviceTotal')} value={money(adviceTotal)} />
              <Row label={t('order.saleTotal')} value={money(saleTotal)} />
              <Row
                label={t('order.discount')}
                value={money(discount)}
                tone={discount > 0 ? 'warning' : undefined}
              />

              {calculation ? (
                <>
                  <Row
                    label={t('contract.priceTolerancePct')}
                    value={money(calculation.tolerance)}
                  />
                  <Row
                    label={t('commission.discountDeduction')}
                    value={money(calculation.discount_deduction)}
                    tone={Number(calculation.discount_deduction) > 0 ? 'danger' : undefined}
                  />
                  <div className="border-t border-line pt-3">
                    {calculation.eligible ? (
                      <Row
                        label={`${t('commission.totalCommission')} (${percent(calculation.pct)})`}
                        value={money(calculation.commission)}
                        strong
                      />
                    ) : (
                      <Alert tone="info">{calculation.ineligible_reason}</Alert>
                    )}
                    {calculation.subagent_amount ? (
                      <div className="mt-2 space-y-1">
                        <Row
                          label={t('commission.subagentShare')}
                          value={money(calculation.subagent_amount)}
                        />
                        <Row
                          label={t('commission.ownShare')}
                          value={money(
                            Number(calculation.commission) -
                              Number(calculation.subagent_amount),
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}

              <p className="text-xs text-navy-300">{t('order.costsExcluded')}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('commission.ledger')}
              description={t('commission.payoutOutside')}
            />
            <CardBody>
              {entries.length === 0 ? (
                <p className="text-sm text-navy-400">{t('common.emptyBody')}</p>
              ) : (
                <ul className="space-y-2">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                    >
                      <div className="min-w-0">
                        <CommissionKindBadge kind={entry.kind} />
                        <p className="mt-1 text-xs text-navy-400">
                          {t(`payableBy.${entry.payable_by}`)} ·{' '}
                          {agentName.get(entry.agent_id) ?? ''}
                        </p>
                      </div>
                      <span
                        className={
                          Number(entry.amount) < 0
                            ? 'font-semibold tabular-nums text-status-redfg'
                            : 'font-semibold tabular-nums text-navy-900'
                        }
                      >
                        {money(entry.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? t(ACTION_LABEL[pending]) : ''}
        requireReason={pending === 'afgekeurd'}
        reasonLabel={t('order.rejectionReason')}
        danger={pending === 'afgekeurd' || pending === 'geannuleerd'}
        loading={changeStatus.isPending}
        onConfirm={(reason) => {
          if (!pending) return;
          changeStatus.mutate({ status: pending, reason });
        }}
      />
    </>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-navy-400">{label}</dt>
      <dd className="text-navy-800">{value}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'warning' | 'danger';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-navy-400">{label}</span>
      <span
        className={[
          'tabular-nums',
          strong ? 'text-lg font-bold text-navy-900' : 'text-navy-800',
          tone === 'warning' ? 'text-status-amberfg' : '',
          tone === 'danger' ? 'text-status-redfg' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
