import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import { useCommissionEntries } from '@/features/orders/queries';
import { formatDate, money, percent } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { CommissionEntryRow } from '@/types/database';
import { CommissionKindBadge } from '@/features/shared/badges';
import {
  Alert,
  Button,
  Card,
  CardBody,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  type Column,
} from '@/components/ui';

export function CommissionPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { profile, isAdmin } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);

  const { data: entries = [], isLoading, error } = useCommissionEntries();
  const { data: profiles = [] } = useProfiles();
  const { data: architects = [] } = useArchitects();

  const agentName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );
  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => entry.contract_year)
            .filter((year): year is number => year !== null),
        ),
      ).sort((a, b) => a - b),
    [entries],
  );

  const rows = useMemo(
    () =>
      entries.filter((entry) => {
        if (agentFilter && entry.agent_id !== agentFilter) return false;
        if (yearFilter && String(entry.contract_year) !== yearFilter) return false;
        if (quarterFilter) {
          const quarter = Math.floor(new Date(entry.created_at).getMonth() / 3) + 1;
          if (String(quarter) !== quarterFilter) return false;
        }
        return true;
      }),
    [entries, agentFilter, yearFilter, quarterFilter],
  );

  // Koreman-totalen tellen alleen wat Koreman verschuldigd is; het deel van de
  // subagent is een afspraak tussen hoofdagent en subagent.
  const totalKoreman = rows
    .filter((entry) => entry.payable_by === 'koreman')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const totalSubagent = rows
    .filter((entry) => entry.payable_by === 'parent_agent')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const addCorrection = useMutation({
    mutationFn: async (values: {
      agent_id: string;
      amount: number;
      note: string;
    }) => {
      const { error: insertError } = await supabase
        .from('commission_entries')
        .insert({
          agent_id: values.agent_id,
          kind: 'correction',
          payable_by: 'koreman',
          base_amount: 0,
          amount: values.amount,
          note: values.note,
          created_by: profile?.id,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      setCorrectionOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['commission-entries'] });
    },
  });

  const columns: Column<CommissionEntryRow>[] = [
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
    ...(isAdmin
      ? [
          {
            key: 'agent',
            header: t('roles.agent'),
            sortValue: (row: CommissionEntryRow) => agentName.get(row.agent_id) ?? '',
            cell: (row: CommissionEntryRow) => agentName.get(row.agent_id) ?? '—',
          },
        ]
      : []),
    {
      key: 'architect',
      header: t('architect.one'),
      sortValue: (row) => {
        const architect = row.architect_id
          ? architectById.get(row.architect_id)
          : null;
        return architect ? `${architect.last_name} ${architect.first_name}` : '';
      },
      cell: (row) => {
        const architect = row.architect_id
          ? architectById.get(row.architect_id)
          : null;
        if (!architect) return <span className="text-navy-300">—</span>;
        return (
          <Link
            to={`/architecten/${architect.id}`}
            className="hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {architect.first_name} {architect.last_name}
          </Link>
        );
      },
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
            Number(row.amount) < 0
              ? 'font-semibold text-status-redfg'
              : 'font-semibold'
          }
        >
          {money(row.amount)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('commission.ledger')}
        description={t('commission.payoutOutside')}
        search={{ value: search, onChange: setSearch }}
        action={
          isAdmin ? (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCorrectionOpen(true)}
            >
              {t('commission.addCorrection')}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-sm text-navy-400">{t('payableBy.koreman')}</p>
            <p className="mt-1 text-kpi tabular-nums text-navy-900">
              {money(totalKoreman)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-navy-400">{t('commission.subagentShare')}</p>
            <p className="mt-1 text-kpi tabular-nums text-navy-900">
              {money(totalSubagent)}
            </p>
            <p className="mt-1 text-xs text-navy-400">
              {t('payableBy.parent_agent')}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 px-5 py-4">
          {isAdmin ? (
            <Filter
              label={t('roles.agent')}
              value={agentFilter}
              onChange={setAgentFilter}
              options={profiles
                .filter((p) => p.role !== 'admin')
                .map((p) => ({ value: p.id, label: p.full_name }))}
            />
          ) : null}
          <Filter
            label={t('contract.contractYear')}
            value={yearFilter}
            onChange={setYearFilter}
            options={years.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
          />
          <Filter
            label={t('commission.quarter')}
            value={quarterFilter}
            onChange={setQuarterFilter}
            options={[1, 2, 3, 4].map((q) => ({ value: String(q), label: `Q${q}` }))}
          />
        </div>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          search={search}
          initialSort={{ key: 'date', dir: 'desc' }}
          emptyTitle={t('commission.ledger')}
        />
      </Card>

      <CorrectionDialog
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        agents={profiles.filter((p) => p.role !== 'admin')}
        onSave={(values) => addCorrection.mutate(values)}
        saving={addCorrection.isPending}
        error={addCorrection.error as Error | null}
      />
    </>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy-500">{label}</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-44"
      >
        <option value="">{t('common.all')}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function CorrectionDialog({
  open,
  onClose,
  agents,
  onSave,
  saving,
  error,
}: {
  open: boolean;
  onClose: () => void;
  agents: { id: string; full_name: string }[];
  onSave: (values: { agent_id: string; amount: number; note: string }) => void;
  saving: boolean;
  error: Error | null;
}) {
  const { t } = useTranslation();
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const invalid = !agentId || !amount || note.trim().length < 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('commission.addCorrection')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={saving}
            disabled={invalid}
            onClick={() =>
              onSave({ agent_id: agentId, amount: Number(amount), note: note.trim() })
            }
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error">{error.message}</Alert> : null}

        <Field label={t('roles.agent')} htmlFor="correction-agent" required>
          <Select
            id="correction-agent"
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
          >
            <option value="">—</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t('commission.amount')}
          htmlFor="correction-amount"
          required
          hint={t('common.exclVat')}
        >
          <Input
            id="correction-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field label={t('commission.correctionNote')} htmlFor="correction-note" required>
          <Textarea
            id="correction-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('common.reasonPlaceholder')}
          />
        </Field>
      </div>
    </Modal>
  );
}
