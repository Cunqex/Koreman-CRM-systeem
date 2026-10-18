import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProfiles } from '@/features/architects/queries';
import { formatDateTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { AuditLogRow, Json } from '@/types/database';
import {
  Badge,
  Card,
  DataTable,
  Field,
  Input,
  PageHeader,
  Select,
  type Column,
} from '@/components/ui';

const TABLES = [
  'profiles',
  'contracts',
  'contract_regions',
  'contract_postcode_exceptions',
  'contract_targets',
  'architects',
  'architect_agreements',
  'projects',
  'activities',
  'collections',
  'orders',
  'order_lines',
];

/** Welke velden zijn er daadwerkelijk veranderd? */
function changedFields(oldData: Json | null, newData: Json | null) {
  const before = (oldData ?? {}) as Record<string, unknown>;
  const after = (newData ?? {}) as Record<string, unknown>;
  return Object.keys(after).filter(
    (key) =>
      key !== 'updated_at' &&
      JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

export function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;

  const [search, setSearch] = useState('');
  const [table, setTable] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: profiles = [] } = useProfiles();
  const userName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['audit-log', table, userId, from, to],
    queryFn: async (): Promise<AuditLogRow[]> => {
      let query = supabase.from('audit_log').select('*');
      if (table) query = query.eq('table_name', table);
      if (userId) query = query.eq('user_id', userId);
      if (from) query = query.gte('created_at', `${from}T00:00:00Z`);
      if (to) query = query.lte('created_at', `${to}T23:59:59Z`);
      const { data, error: queryError } = await query
        .order('created_at', { ascending: false })
        .limit(500);
      if (queryError) throw queryError;
      return data;
    },
  });

  const columns: Column<AuditLogRow>[] = [
    {
      key: 'created',
      header: t('common.date'),
      sortValue: (row) => row.created_at,
      cell: (row) => (
        <span className="whitespace-nowrap">
          {formatDateTime(row.created_at, lang)}
        </span>
      ),
    },
    {
      key: 'table',
      header: t('audit.table'),
      sortValue: (row) => row.table_name,
      cell: (row) => (
        <code className="rounded bg-navy-50 px-1.5 py-0.5 text-xs text-navy-700">
          {row.table_name}
        </code>
      ),
    },
    {
      key: 'action',
      header: t('audit.action'),
      sortValue: (row) => row.action,
      cell: (row) => (
        <Badge tone={row.action === 'insert' ? 'green' : 'blue'}>
          {t(`audit.${row.action}`)}
        </Badge>
      ),
    },
    {
      key: 'user',
      header: t('audit.user'),
      sortValue: (row) => (row.user_id ? (userName.get(row.user_id) ?? '') : ''),
      cell: (row) =>
        row.user_id ? (
          (userName.get(row.user_id) ?? row.user_id.slice(0, 8))
        ) : (
          <span className="text-navy-300">—</span>
        ),
    },
    {
      key: 'record',
      header: t('audit.record'),
      sortValue: (row) => row.record_id ?? '',
      cell: (row) => (
        <code className="text-xs text-navy-400">
          {row.record_id ? row.record_id.slice(0, 8) : '—'}
        </code>
      ),
    },
    {
      key: 'changes',
      header: t('audit.newValue'),
      sortable: false,
      sortValue: (row) => changedFields(row.old_data, row.new_data).join(' '),
      cell: (row) => {
        if (row.action === 'insert') {
          return <span className="text-xs text-navy-400">{t('audit.insert')}</span>;
        }
        const fields = changedFields(row.old_data, row.new_data);
        if (fields.length === 0) {
          return <span className="text-navy-300">—</span>;
        }
        const before = (row.old_data ?? {}) as Record<string, unknown>;
        const after = (row.new_data ?? {}) as Record<string, unknown>;
        return (
          <ul className="space-y-0.5 text-xs">
            {fields.slice(0, 4).map((field) => (
              <li key={field} className="flex flex-wrap gap-1">
                <span className="font-medium text-navy-700">{field}:</span>
                <span className="text-status-redfg line-through">
                  {String(before[field] ?? '—').slice(0, 40)}
                </span>
                <span className="text-navy-300">→</span>
                <span className="text-status-greenfg">
                  {String(after[field] ?? '—').slice(0, 40)}
                </span>
              </li>
            ))}
            {fields.length > 4 ? (
              <li className="text-navy-400">+{fields.length - 4}</li>
            ) : null}
          </ul>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        description={t('audit.adminOnly')}
        search={{ value: search, onChange: setSearch }}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 px-5 py-4">
          <Field label={t('audit.table')} htmlFor="audit-table">
            <Select
              id="audit-table"
              value={table}
              onChange={(event) => setTable(event.target.value)}
              className="w-52"
            >
              <option value="">{t('common.all')}</option>
              {TABLES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('audit.user')} htmlFor="audit-user">
            <Select
              id="audit-user"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="w-52"
            >
              <option value="">{t('common.all')}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('common.date')} htmlFor="audit-from">
            <Input
              id="audit-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>

          <Field label={t('common.next')} htmlFor="audit-to">
            <Input
              id="audit-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
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
          pageSize={50}
          initialSort={{ key: 'created', dir: 'desc' }}
          emptyTitle={t('audit.title')}
        />
      </Card>
    </>
  );
}
