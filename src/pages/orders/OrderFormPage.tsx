import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitects, useProjects } from '@/features/architects/queries';
import {
  useCollections,
  useContractForAgent,
  useOrder,
} from '@/features/orders/queries';
import { estimateCommission } from '@/features/orders/estimate';
import { money, percent } from '@/lib/format';
import type { OrderLineShape } from '@/types/database';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';

const SHAPES: OrderLineShape[] = [
  'rechthoek',
  'rond',
  'ovaal',
  'organisch',
  'anders',
];

type LineDraft = {
  /** Bestaande regel houdt zijn id, zodat bewerken geen rij hoeft te vervangen. */
  id?: string;
  collection_id: string;
  design_name: string;
  width_cm: string;
  length_cm: string;
  shape: string;
  custom_edits: string;
  quantity: string;
  advice_price: string;
  sale_price: string;
};

function emptyLine(): LineDraft {
  return {
    collection_id: '',
    design_name: '',
    width_cm: '',
    length_cm: '',
    shape: '',
    custom_edits: '',
    quantity: '1',
    advice_price: '',
    sale_price: '',
  };
}

export function OrderFormPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useSession();

  const isEdit = Boolean(orderId);
  const { data: existing, isLoading: loadingOrder } = useOrder(orderId);

  const [architectId, setArchitectId] = useState(params.get('architect') ?? '');
  const [projectId, setProjectId] = useState('');
  const [orderDate, setOrderDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = useState('');
  const [shipping, setShipping] = useState('0');
  const [installation, setInstallation] = useState('0');
  const [agentNotes, setAgentNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [removedLineIds, setRemovedLineIds] = useState<string[]>([]);

  const { data: architects = [] } = useArchitects();
  const { data: projects = [] } = useProjects(architectId || undefined);
  const { data: collections = [] } = useCollections();
  const { data: contract } = useContractForAgent(profile?.id, orderDate);

  useEffect(() => {
    if (!existing) return;
    setArchitectId(existing.architect_id);
    setProjectId(existing.project_id ?? '');
    setOrderDate(existing.order_date);
    setReference(existing.reference ?? '');
    setShipping(String(existing.shipping_cost));
    setInstallation(String(existing.installation_cost));
    setAgentNotes(existing.agent_notes ?? '');
    setLines(
      existing.order_lines.length > 0
        ? existing.order_lines.map((line) => ({
            id: line.id,
            collection_id: line.collection_id ?? '',
            design_name: line.design_name ?? '',
            width_cm: line.width_cm?.toString() ?? '',
            length_cm: line.length_cm?.toString() ?? '',
            shape: line.shape ?? '',
            custom_edits: line.custom_edits ?? '',
            quantity: String(line.quantity),
            advice_price: String(line.advice_price),
            sale_price: String(line.sale_price),
          }))
        : [emptyLine()],
    );
  }, [existing]);

  const architect = architects.find((a) => a.id === architectId) ?? null;

  // Exclusieve collecties horen bij één architect en zijn daarbuiten niet
  // te kiezen. De database weigert het ook, dit voorkomt de foutmelding.
  const selectableCollections = useMemo(
    () =>
      collections.filter(
        (collection) =>
          !collection.is_exclusive ||
          collection.exclusive_architect_id === architectId,
      ),
    [collections, architectId],
  );

  const estimate = useMemo(
    () =>
      estimateCommission({
        lines: lines.map((line) => ({
          advice_price: Number(line.advice_price) || 0,
          sale_price: Number(line.sale_price) || 0,
        })),
        architect,
        contract: contract ?? null,
        orderDate,
      }),
    [lines, architect, contract, orderDate],
  );

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(index: number) {
    const line = lines[index];
    if (line?.id) setRemovedLineIds((ids) => [...ids, line.id!]);
    setLines((current) => current.filter((_, i) => i !== index));
  }

  const save = useMutation({
    mutationFn: async () => {
      const orderPayload = {
        architect_id: architectId,
        project_id: projectId || null,
        order_date: orderDate,
        reference: reference.trim() || null,
        shipping_cost: Number(shipping) || 0,
        installation_cost: Number(installation) || 0,
        agent_notes: agentNotes.trim() || null,
      };

      let id = orderId;

      if (isEdit) {
        const { error } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('orders')
          .insert({
            ...orderPayload,
            agent_id: profile!.id,
            created_by: profile!.id,
            status: 'ingediend',
          })
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
      }

      if (removedLineIds.length > 0) {
        const { error } = await supabase
          .from('order_lines')
          .delete()
          .in('id', removedLineIds);
        if (error) throw error;
      }

      for (const line of lines) {
        const payload = {
          order_id: id!,
          collection_id: line.collection_id || null,
          design_name: line.design_name.trim() || null,
          width_cm: line.width_cm ? Number(line.width_cm) : null,
          length_cm: line.length_cm ? Number(line.length_cm) : null,
          shape: (line.shape || null) as OrderLineShape | null,
          custom_edits: line.custom_edits.trim() || null,
          quantity: Number(line.quantity) || 1,
          advice_price: Number(line.advice_price) || 0,
          sale_price: Number(line.sale_price) || 0,
        };

        if (line.id) {
          const { error } = await supabase
            .from('order_lines')
            .update(payload)
            .eq('id', line.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('order_lines').insert(payload);
          if (error) throw error;
        }
      }

      return id!;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
      navigate(`/orders/${id}`);
    },
  });

  if (isEdit && loadingOrder) {
    return <Card><CardBody>{t('common.loading')}</CardBody></Card>;
  }

  if (isEdit && existing && existing.status !== 'ingediend') {
    return (
      <Card>
        <CardBody>
          <Alert tone="warning">{t('order.editOnlySubmitted')}</Alert>
        </CardBody>
      </Card>
    );
  }

  const canSave =
    Boolean(architectId) &&
    lines.length > 0 &&
    lines.every((line) => Number(line.advice_price) > 0);

  return (
    <>
      <PageHeader
        title={isEdit ? t('common.edit') : t('order.newTitle')}
        description={t('common.exclVat')}
      />

      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-4 lg:col-span-2">
          {save.error ? (
            <Alert tone="error">{(save.error as Error).message}</Alert>
          ) : null}

          <Card>
            <CardHeader title={t('order.one')} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t('architect.one')} htmlFor="order-architect" required>
                <Select
                  id="order-architect"
                  value={architectId}
                  onChange={(e) => {
                    setArchitectId(e.target.value);
                    setProjectId('');
                  }}
                >
                  <option value="">—</option>
                  {architects.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.last_name}, {a.first_name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('project.one')} htmlFor="order-project">
                <Select
                  id="order-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={projects.length === 0}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('order.orderDate')} htmlFor="order-date" required>
                <Input
                  id="order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </Field>

              <Field label={t('order.reference')} htmlFor="order-reference">
                <Input
                  id="order-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('order.lines')}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setLines((current) => [...current, emptyLine()])}
                >
                  {t('order.addLine')}
                </Button>
              }
            />
            <CardBody className="space-y-5">
              {lines.map((line, index) => (
                <div
                  key={line.id ?? `new-${index}`}
                  className="rounded-xl border border-line p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy-700">
                      {t('order.lines')} {index + 1}
                    </p>
                    {lines.length > 1 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => removeLine(index)}
                      >
                        {t('common.delete')}
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('order.collection')} htmlFor={`col-${index}`}>
                      <Select
                        id={`col-${index}`}
                        value={line.collection_id}
                        onChange={(e) =>
                          updateLine(index, { collection_id: e.target.value })
                        }
                      >
                        <option value="">—</option>
                        {selectableCollections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.name}
                            {collection.is_exclusive ? ' ★' : ''}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label={t('order.designName')} htmlFor={`design-${index}`}>
                      <Input
                        id={`design-${index}`}
                        value={line.design_name}
                        onChange={(e) =>
                          updateLine(index, { design_name: e.target.value })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-3 gap-2">
                      <Field label={t('order.width')} htmlFor={`w-${index}`}>
                        <Input
                          id={`w-${index}`}
                          type="number"
                          min="0"
                          step="0.1"
                          value={line.width_cm}
                          onChange={(e) =>
                            updateLine(index, { width_cm: e.target.value })
                          }
                        />
                      </Field>
                      <Field label={t('order.length')} htmlFor={`l-${index}`}>
                        <Input
                          id={`l-${index}`}
                          type="number"
                          min="0"
                          step="0.1"
                          value={line.length_cm}
                          onChange={(e) =>
                            updateLine(index, { length_cm: e.target.value })
                          }
                        />
                      </Field>
                      <Field label={t('order.quantity')} htmlFor={`q-${index}`}>
                        <Input
                          id={`q-${index}`}
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(index, { quantity: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    <Field label={t('order.shape')} htmlFor={`shape-${index}`}>
                      <Select
                        id={`shape-${index}`}
                        value={line.shape}
                        onChange={(e) => updateLine(index, { shape: e.target.value })}
                      >
                        <option value="">—</option>
                        {SHAPES.map((shape) => (
                          <option key={shape} value={shape}>
                            {t(`shape.${shape}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      label={t('order.customEdits')}
                      htmlFor={`edits-${index}`}
                      className="sm:col-span-2"
                    >
                      <Textarea
                        id={`edits-${index}`}
                        rows={2}
                        value={line.custom_edits}
                        onChange={(e) =>
                          updateLine(index, { custom_edits: e.target.value })
                        }
                      />
                    </Field>

                    <Field
                      label={t('order.advicePrice')}
                      htmlFor={`advice-${index}`}
                      required
                      hint={t('common.exclVat')}
                    >
                      <Input
                        id={`advice-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.advice_price}
                        onChange={(e) =>
                          updateLine(index, { advice_price: e.target.value })
                        }
                      />
                    </Field>

                    <Field
                      label={t('order.salePrice')}
                      htmlFor={`sale-${index}`}
                      required
                      hint={t('common.exclVat')}
                    >
                      <Input
                        id={`sale-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.sale_price}
                        onChange={(e) =>
                          updateLine(index, { sale_price: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('order.shippingCost')}
              description={t('order.costsExcluded')}
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t('order.shippingCost')} htmlFor="shipping">
                <Input
                  id="shipping"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                />
              </Field>
              <Field label={t('order.installationCost')} htmlFor="installation">
                <Input
                  id="installation"
                  type="number"
                  min="0"
                  step="0.01"
                  value={installation}
                  onChange={(e) => setInstallation(e.target.value)}
                />
              </Field>
              <Field
                label={t('order.agentNotes')}
                htmlFor="agent-notes"
                className="sm:col-span-2"
              >
                <Textarea
                  id="agent-notes"
                  value={agentNotes}
                  onChange={(e) => setAgentNotes(e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>
        </div>

        {/* Live indicatie, meeschuivend */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title={t('order.estimatedCommission')} />
            <CardBody className="space-y-3 text-sm">
              <Row label={t('order.adviceTotal')} value={money(estimate.adviceTotal)} />
              <Row label={t('order.saleTotal')} value={money(estimate.saleTotal)} />
              <Row
                label={t('order.discount')}
                value={money(estimate.discount)}
                tone={estimate.discount > 0 ? 'warning' : undefined}
              />
              <Row
                label={t('contract.priceTolerancePct')}
                value={money(estimate.tolerance)}
              />
              <Row
                label={t('commission.discountDeduction')}
                value={money(estimate.discountDeduction)}
                tone={estimate.discountDeduction > 0 ? 'danger' : undefined}
              />

              <div className="border-t border-line pt-3">
                {estimate.eligible ? (
                  <>
                    <Row
                      label={`${t('commission.one')} (${percent(estimate.pct)})`}
                      value={money(estimate.commission)}
                      strong
                    />
                    {estimate.discountDeduction > 0 ? (
                      <p className="mt-2 text-xs text-navy-400">
                        {t('order.discountExplainer')}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <Alert tone="info">
                    {estimate.reason === 'architect_excluded'
                      ? t('architect.excludedFromCommission')
                      : estimate.reason === 'order_before_transfer'
                        ? t('origin.koreman_transferred')
                        : t('commission.one')}
                  </Alert>
                )}
                <p className="mt-2 text-xs text-navy-300">
                  {t('order.estimateHint')}
                </p>
              </div>
            </CardBody>
          </Card>

          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={save.isPending} disabled={!canSave}>
              {isEdit ? t('common.save') : t('order.submit')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </form>
    </>
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
