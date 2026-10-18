import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Plus, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import {
  useAgreement,
  useArchitectActivities,
  useArchitectCommission,
  useArchitectOrders,
  useDocuments,
  useProfiles,
  useProjects,
} from '@/features/architects/queries';
import { formatDate, formatDateTime, money, percent } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { ProjectStatus } from '@/types/database';
import {
  CommissionKindBadge,
  OrderStatusBadge,
  ProjectStatusBadge,
} from '@/features/shared/badges';
import {
  Alert,
  Badge,
  Button,

  CardBody,
  CardHeader,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  Timeline,
  type Column,
  type TimelineEntry,
} from '@/components/ui';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/* -------------------------------------------------------------------------
 * Tijdlijn: activiteiten en orders chronologisch door elkaar
 * ---------------------------------------------------------------------- */
export function TimelineTab({ architectId }: { architectId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: activities = [], isLoading } = useArchitectActivities(architectId);
  const { data: orders = [] } = useArchitectOrders(architectId);
  const { data: profiles = [] } = useProfiles();

  const nameById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const entries: TimelineEntry[] = useMemo(() => {
    const fromActivities = activities.map<TimelineEntry>((activity) => ({
      id: `a-${activity.id}`,
      at: activity.created_at,
      title: activity.subject,
      body: activity.notes ?? undefined,
      actor: nameById.get(activity.agent_id) ?? null,
      badges: (
        <>
          <Badge tone="blue">{t(`activityType.${activity.type}`)}</Badge>
          <Badge tone="grey">{formatDate(activity.activity_date, lang)}</Badge>
          {activity.edited_at ? (
            <Badge tone="amber" title={formatDateTime(activity.edited_at, lang)}>
              {t('common.edited')}
            </Badge>
          ) : null}
          {activity.follow_up_date && !activity.follow_up_done ? (
            <Badge tone="purple">
              {t('activity.followUpDate')}: {formatDate(activity.follow_up_date, lang)}
            </Badge>
          ) : null}
        </>
      ),
    }));

    const fromOrders = orders.map<TimelineEntry>((order) => ({
      id: `o-${order.id}`,
      at: order.created_at,
      title: `${t('order.one')} ${order.reference ?? order.id.slice(0, 8)}`,
      actor: nameById.get(order.agent_id) ?? null,
      icon: <FileText className="h-4 w-4" />,
      badges: <OrderStatusBadge status={order.status} />,
    }));

    return [...fromActivities, ...fromOrders].sort((a, b) =>
      a.at < b.at ? 1 : -1,
    );
  }, [activities, orders, nameById, t, lang]);

  if (isLoading) return <CardBody>{t('common.loading')}</CardBody>;

  return <Timeline entries={entries} emptyTitle={t('common.emptyTimeline')} />;
}

/* -------------------------------------------------------------------------
 * Afspraken
 * ---------------------------------------------------------------------- */
export function AgreementsTab({
  architectId,
  canEdit,
}: {
  architectId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: agreement, isLoading } = useAgreement(architectId);
  const [editing, setEditing] = useState(false);

  const [values, setValues] = useState({
    trade_discount_pct: '',
    payment_terms: '',
    lead_time_agreement: '',
    samples_arrangement: '',
    delivery_agreement: '',
    exclusive_collection_agreed: false,
    other_agreements: '',
    notes: '',
  });

  function startEditing() {
    setValues({
      trade_discount_pct: agreement?.trade_discount_pct?.toString() ?? '',
      payment_terms: agreement?.payment_terms ?? '',
      lead_time_agreement: agreement?.lead_time_agreement ?? '',
      samples_arrangement: agreement?.samples_arrangement ?? '',
      delivery_agreement: agreement?.delivery_agreement ?? '',
      exclusive_collection_agreed: agreement?.exclusive_collection_agreed ?? false,
      other_agreements: agreement?.other_agreements ?? '',
      notes: agreement?.notes ?? '',
    });
    setEditing(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        architect_id: architectId,
        trade_discount_pct: values.trade_discount_pct
          ? Number(values.trade_discount_pct)
          : null,
        payment_terms: values.payment_terms.trim() || null,
        lead_time_agreement: values.lead_time_agreement.trim() || null,
        samples_arrangement: values.samples_arrangement.trim() || null,
        delivery_agreement: values.delivery_agreement.trim() || null,
        exclusive_collection_agreed: values.exclusive_collection_agreed,
        other_agreements: values.other_agreements.trim() || null,
        notes: values.notes.trim() || null,
      };
      // Eén afsprakenrij per architect; de historie loopt via de audit log.
      const { error } = await supabase
        .from('architect_agreements')
        .upsert(payload, { onConflict: 'architect_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['agreement', architectId] });
    },
  });

  if (isLoading) return <CardBody>{t('common.loading')}</CardBody>;

  if (!editing) {
    const rows: [string, string][] = [
      [t('agreement.tradeDiscountPct'), percent(agreement?.trade_discount_pct)],
      [t('agreement.paymentTerms'), agreement?.payment_terms ?? '—'],
      [t('agreement.leadTimeAgreement'), agreement?.lead_time_agreement ?? '—'],
      [t('agreement.samplesArrangement'), agreement?.samples_arrangement ?? '—'],
      [t('agreement.deliveryAgreement'), agreement?.delivery_agreement ?? '—'],
      [
        t('agreement.exclusiveCollectionAgreed'),
        agreement?.exclusive_collection_agreed ? t('common.yes') : t('common.no'),
      ],
      [t('agreement.otherAgreements'), agreement?.other_agreements ?? '—'],
      [t('common.notes'), agreement?.notes ?? '—'],
    ];

    return (
      <>
        <CardHeader
          title={t('agreement.title')}
          action={
            canEdit ? (
              <Button size="sm" variant="secondary" onClick={startEditing}>
                {agreement ? t('common.edit') : t('common.add')}
              </Button>
            ) : null
          }
        />
        <CardBody>
          <dl className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-3">
                <dt className="text-sm text-navy-400">{label}</dt>
                <dd className="whitespace-pre-line text-sm text-navy-800 sm:col-span-2">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </>
    );
  }

  return (
    <>
      <CardHeader title={t('agreement.title')} />
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {save.error ? (
            <Alert tone="error" className="sm:col-span-2">
              {(save.error as Error).message}
            </Alert>
          ) : null}

          <Field label={t('agreement.tradeDiscountPct')} htmlFor="trade_discount_pct">
            <Input
              id="trade_discount_pct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={values.trade_discount_pct}
              onChange={(e) =>
                setValues({ ...values, trade_discount_pct: e.target.value })
              }
            />
          </Field>
          <Field label={t('agreement.paymentTerms')} htmlFor="payment_terms">
            <Input
              id="payment_terms"
              value={values.payment_terms}
              onChange={(e) => setValues({ ...values, payment_terms: e.target.value })}
            />
          </Field>
          <Field label={t('agreement.leadTimeAgreement')} htmlFor="lead_time">
            <Input
              id="lead_time"
              value={values.lead_time_agreement}
              onChange={(e) =>
                setValues({ ...values, lead_time_agreement: e.target.value })
              }
            />
          </Field>
          <Field label={t('agreement.samplesArrangement')} htmlFor="samples">
            <Input
              id="samples"
              value={values.samples_arrangement}
              onChange={(e) =>
                setValues({ ...values, samples_arrangement: e.target.value })
              }
            />
          </Field>
          <Field label={t('agreement.deliveryAgreement')} htmlFor="delivery">
            <Input
              id="delivery"
              value={values.delivery_agreement}
              onChange={(e) =>
                setValues({ ...values, delivery_agreement: e.target.value })
              }
            />
          </Field>
          <div className="flex items-end">
            <Checkbox
              label={t('agreement.exclusiveCollectionAgreed')}
              checked={values.exclusive_collection_agreed}
              onChange={(e) =>
                setValues({ ...values, exclusive_collection_agreed: e.target.checked })
              }
            />
          </div>
          <Field
            label={t('agreement.otherAgreements')}
            htmlFor="other"
            className="sm:col-span-2"
          >
            <Textarea
              id="other"
              value={values.other_agreements}
              onChange={(e) =>
                setValues({ ...values, other_agreements: e.target.value })
              }
            />
          </Field>
          <Field label={t('common.notes')} htmlFor="agreement_notes" className="sm:col-span-2">
            <Textarea
              id="agreement_notes"
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </Field>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </CardBody>
    </>
  );
}

/* -------------------------------------------------------------------------
 * Projecten
 * ---------------------------------------------------------------------- */
export function ProjectsTab({
  architectId,
  canEdit,
}: {
  architectId: string;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading, error } = useProjects(architectId);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    name: '',
    city: '',
    status: 'lopend' as ProjectStatus,
    end_client_name: '',
    end_client_email: '',
    end_client_phone: '',
    notes: '',
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error: insertError } = await supabase.from('projects').insert({
        architect_id: architectId,
        name: values.name.trim(),
        city: values.city.trim() || null,
        status: values.status,
        end_client_name: values.end_client_name.trim() || null,
        end_client_email: values.end_client_email.trim() || null,
        end_client_phone: values.end_client_phone.trim() || null,
        notes: values.notes.trim() || null,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      setOpen(false);
      setValues({
        name: '',
        city: '',
        status: 'lopend',
        end_client_name: '',
        end_client_email: '',
        end_client_phone: '',
        notes: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const columns: Column<(typeof projects)[number]>[] = [
    {
      key: 'name',
      header: t('project.name'),
      sortValue: (row) => row.name,
      cell: (row) => <span className="font-medium text-navy-900">{row.name}</span>,
    },
    {
      key: 'city',
      header: t('project.city'),
      sortValue: (row) => row.city ?? '',
      cell: (row) => row.city ?? '—',
    },
    {
      key: 'client',
      header: t('project.endClientName'),
      sortValue: (row) => row.end_client_name ?? '',
      cell: (row) => row.end_client_name ?? <span className="text-navy-300">—</span>,
    },
    {
      key: 'status',
      header: t('project.status'),
      sortValue: (row) => row.status,
      cell: (row) => <ProjectStatusBadge status={row.status} />,
    },
    {
      key: 'created',
      header: t('common.created'),
      sortValue: (row) => row.created_at,
      cell: (row) => formatDate(row.created_at, lang),
    },
  ];

  return (
    <>
      <CardHeader
        title={t('project.other')}
        action={
          canEdit ? (
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              {t('common.add')}
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        rows={projects}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error}
        emptyTitle={t('project.other')}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('project.other')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => create.mutate()}
              loading={create.isPending}
              disabled={values.name.trim().length === 0}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {create.error ? (
            <Alert tone="error">{(create.error as Error).message}</Alert>
          ) : null}

          <Field label={t('project.name')} htmlFor="project_name" required>
            <Input
              id="project_name"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </Field>
          <Field label={t('project.city')} htmlFor="project_city">
            <Input
              id="project_city"
              value={values.city}
              onChange={(e) => setValues({ ...values, city: e.target.value })}
            />
          </Field>
          <Field label={t('project.status')} htmlFor="project_status">
            <Select
              id="project_status"
              value={values.status}
              onChange={(e) =>
                setValues({ ...values, status: e.target.value as ProjectStatus })
              }
            >
              {(['lopend', 'afgerond', 'vervallen'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`projectStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>

          <p className="text-xs text-navy-400">{t('project.endClientOptional')}</p>

          <Field label={t('project.endClientName')} htmlFor="end_client_name">
            <Input
              id="end_client_name"
              value={values.end_client_name}
              onChange={(e) => setValues({ ...values, end_client_name: e.target.value })}
            />
          </Field>
          <Field label={t('project.endClientEmail')} htmlFor="end_client_email">
            <Input
              id="end_client_email"
              type="email"
              value={values.end_client_email}
              onChange={(e) => setValues({ ...values, end_client_email: e.target.value })}
            />
          </Field>
          <Field label={t('project.endClientPhone')} htmlFor="end_client_phone">
            <Input
              id="end_client_phone"
              value={values.end_client_phone}
              onChange={(e) => setValues({ ...values, end_client_phone: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------
 * Documenten
 * ---------------------------------------------------------------------- */
export function DocumentsTab({
  architectId,
  canEdit,
}: {
  architectId: string;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const { data: documents = [], isLoading, error } = useDocuments(architectId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setUploadError(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(t('document.tooLarge'));
      return;
    }

    setBusy(true);
    // Padafspraak <architect_id>/<uuid>-<naam>: de Storage-policy leest de
    // architect uit de eerste map en past dezelfde zichtbaarheid toe.
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${architectId}/${crypto.randomUUID()}-${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(path, file, { contentType: file.type || undefined });

    if (storageError) {
      setUploadError(storageError.message);
      setBusy(false);
      return;
    }

    const { error: rowError } = await supabase.from('documents').insert({
      architect_id: architectId,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size: file.size,
      uploaded_by: profile?.id,
    });

    if (rowError) {
      // Metadata mislukt: het bestand weer weghalen zodat er geen wees
      // achterblijft in de bucket.
      await supabase.storage.from('documents').remove([path]);
      setUploadError(rowError.message);
    }

    setBusy(false);
    void queryClient.invalidateQueries({ queryKey: ['documents', architectId] });
  }

  async function download(path: string) {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }

  const columns: Column<(typeof documents)[number]>[] = [
    {
      key: 'name',
      header: t('document.fileName'),
      sortValue: (row) => row.file_name,
      cell: (row) => (
        <span className="flex items-center gap-2 font-medium text-navy-800">
          <FileText className="h-4 w-4 text-navy-300" />
          {row.file_name}
        </span>
      ),
    },
    {
      key: 'size',
      header: t('document.size'),
      align: 'right',
      sortValue: (row) => row.size ?? 0,
      cell: (row) =>
        row.size ? `${(row.size / 1024 / 1024).toFixed(2)} MB` : '—',
    },
    {
      key: 'created',
      header: t('common.created'),
      sortValue: (row) => row.created_at,
      cell: (row) => formatDate(row.created_at, lang),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      sortable: false,
      cell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          icon={<Download className="h-4 w-4" />}
          onClick={() => void download(row.file_path)}
        >
          {t('document.download')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <CardHeader
        title={t('document.other')}
        description={t('document.maxSize')}
        action={
          canEdit ? (
            <>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = '';
                }}
              />
              <Button
                size="sm"
                loading={busy}
                icon={<Upload className="h-4 w-4" />}
                onClick={() => fileInput.current?.click()}
              >
                {t('document.upload')}
              </Button>
            </>
          ) : null
        }
      />
      {uploadError ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{uploadError}</Alert>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        rows={documents}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error}
        emptyTitle={t('document.other')}
      />
    </>
  );
}

/* -------------------------------------------------------------------------
 * Orders
 * ---------------------------------------------------------------------- */
export function OrdersTab({ architectId }: { architectId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: orders = [], isLoading, error } = useArchitectOrders(architectId);

  const columns: Column<(typeof orders)[number]>[] = [
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
      key: 'date',
      header: t('order.orderDate'),
      sortValue: (row) => row.order_date,
      cell: (row) => formatDate(row.order_date, lang),
    },
    {
      key: 'advice',
      header: t('order.adviceTotal'),
      align: 'right',
      sortValue: (row) =>
        row.order_lines.reduce((sum, line) => sum + Number(line.advice_price), 0),
      cell: (row) =>
        money(
          row.order_lines.reduce((sum, line) => sum + Number(line.advice_price), 0),
        ),
    },
    {
      key: 'sale',
      header: t('order.saleTotal'),
      align: 'right',
      sortValue: (row) =>
        row.order_lines.reduce((sum, line) => sum + Number(line.sale_price), 0),
      cell: (row) =>
        money(
          row.order_lines.reduce((sum, line) => sum + Number(line.sale_price), 0),
        ),
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
      <CardHeader title={t('order.other')} description={t('common.exclVat')} />
      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error}
        emptyTitle={t('order.other')}
      />
    </>
  );
}

/* -------------------------------------------------------------------------
 * Commissie
 * ---------------------------------------------------------------------- */
export function CommissionTab({ architectId }: { architectId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: entries = [], isLoading, error } = useArchitectCommission(architectId);

  const total = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);

  const columns: Column<(typeof entries)[number]>[] = [
    {
      key: 'created',
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
      key: 'base',
      header: t('commission.baseAmount'),
      align: 'right',
      sortValue: (row) => Number(row.base_amount),
      cell: (row) => money(row.base_amount),
    },
    {
      key: 'pct',
      header: t('commission.pct'),
      align: 'right',
      sortValue: (row) => Number(row.pct ?? 0),
      cell: (row) => percent(row.pct),
    },
    {
      key: 'deduction',
      header: t('commission.discountDeduction'),
      align: 'right',
      sortValue: (row) => Number(row.discount_deduction),
      cell: (row) => money(row.discount_deduction),
    },
    {
      key: 'amount',
      header: t('commission.amount'),
      align: 'right',
      sortValue: (row) => Number(row.amount),
      cell: (row) => (
        <span
          className={
            Number(row.amount) < 0 ? 'font-medium text-status-redfg' : 'font-medium'
          }
        >
          {money(row.amount)}
        </span>
      ),
    },
  ];

  return (
    <>
      <CardHeader
        title={t('commission.one')}
        description={t('commission.payoutOutside')}
        action={
          <span className="text-sm text-navy-500">
            {t('common.total')}:{' '}
            <span className="font-semibold text-navy-900">{money(total)}</span>
          </span>
        }
      />
      <DataTable
        columns={columns}
        rows={entries}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error}
        emptyTitle={t('commission.ledger')}
      />
    </>
  );
}

/* -------------------------------------------------------------------------
 * Historie (alleen Koreman)
 * ---------------------------------------------------------------------- */
export function HistoryTab({ architectId }: { architectId: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { data: profiles = [] } = useProfiles();

  const nameById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'architect', architectId],
    queryFn: async () => {
      const [audit, claims] = await Promise.all([
        supabase
          .from('audit_log')
          .select('*')
          .eq('table_name', 'architects')
          .eq('record_id', architectId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('claim_actions')
          .select('*')
          .eq('architect_id', architectId)
          .order('performed_at', { ascending: false }),
      ]);
      return { audit: audit.data ?? [], claims: claims.data ?? [] };
    },
  });

  if (isLoading) return <CardBody>{t('common.loading')}</CardBody>;

  const claims = data?.claims ?? [];
  const audit = data?.audit ?? [];

  return (
    <>
      <CardHeader title={t('audit.title')} description={t('audit.adminOnly')} />
      <CardBody className="space-y-6">
        {claims.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">
              {t('claimAction.title')}
            </h3>
            <ul className="space-y-2">
              {claims.map((claim) => (
                <li key={claim.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium text-navy-900">
                    {t(`claimAction.${claim.action}`)}
                  </p>
                  <p className="mt-0.5 text-sm text-navy-500">{claim.reason}</p>
                  <p className="mt-1 text-xs text-navy-400">
                    {formatDateTime(claim.performed_at, lang)}
                    {claim.performed_by
                      ? ` · ${nameById.get(claim.performed_by) ?? ''}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {audit.length === 0 ? (
          <EmptyState title={t('audit.title')} />
        ) : (
          <ul className="space-y-2">
            {audit.map((entry) => {
              const before = (entry.old_data ?? {}) as Record<string, unknown>;
              const after = (entry.new_data ?? {}) as Record<string, unknown>;
              const changed = Object.keys(after).filter(
                (key) =>
                  key !== 'updated_at' &&
                  JSON.stringify(before[key]) !== JSON.stringify(after[key]),
              );

              return (
                <li key={entry.id} className="rounded-lg border border-line p-3">
                  <p className="text-xs text-navy-400">
                    {formatDateTime(entry.created_at, lang)}
                    {entry.user_id ? ` · ${nameById.get(entry.user_id) ?? ''}` : ''}
                    {' · '}
                    {t(`audit.${entry.action}`)}
                  </p>
                  {entry.action === 'update' && changed.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {changed.map((key) => (
                        <li key={key} className="flex flex-wrap gap-1">
                          <span className="font-medium text-navy-700">{key}:</span>
                          <span className="text-status-redfg line-through">
                            {String(before[key] ?? '—')}
                          </span>
                          <span className="text-navy-300">→</span>
                          <span className="text-status-greenfg">
                            {String(after[key] ?? '—')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </>
  );
}
