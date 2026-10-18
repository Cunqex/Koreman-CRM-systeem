import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import { formatDate, formatDateTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { ActivityRow, ActivityType } from '@/types/database';
import {
  ACTIVITY_TYPES,
  ActivityDialog,
  canEditActivity,
} from '@/features/activities/ActivityDialog';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Select,
  Tabs,
  type Column,
} from '@/components/ui';

export function ActivitiesPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const queryClient = useQueryClient();
  const { isAdmin } = useSession();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | undefined>();

  const { data: architects = [] } = useArchitects();
  const { data: profiles = [] } = useProfiles();

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['activities', 'all'],
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error: queryError } = await supabase
        .from('activities')
        .select('*')
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000);
      if (queryError) throw queryError;
      return data;
    },
  });

  const architectById = useMemo(
    () => new Map(architects.map((a) => [a.id, a])),
    [architects],
  );
  const agentName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const markDone = useMutation({
    mutationFn: async (activity: ActivityRow) => {
      const { error: updateError } = await supabase
        .from('activities')
        .update({ follow_up_done: true })
        .eq('id', activity.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities'] }),
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    return activities.filter((activity) => {
      if (typeFilter && activity.type !== typeFilter) return false;
      if (agentFilter && activity.agent_id !== agentFilter) return false;
      if (tab === 'followups') {
        if (activity.follow_up_done || !activity.follow_up_date) return false;
      }
      return true;
    });
  }, [activities, typeFilter, agentFilter, tab]);

  const openFollowUps = activities.filter(
    (a) => a.follow_up_date && !a.follow_up_done,
  ).length;

  function architectLabel(activity: ActivityRow) {
    const architect = architectById.get(activity.architect_id);
    return architect ? `${architect.first_name} ${architect.last_name}` : '—';
  }

  const columns: Column<ActivityRow>[] = [
    {
      key: 'date',
      header: t('activity.date'),
      sortValue: (row) => row.activity_date,
      cell: (row) => (
        <div>
          <p>{formatDate(row.activity_date, lang)}</p>
          {row.edited_at ? (
            <span
              className="text-xs text-status-amberfg"
              title={formatDateTime(row.edited_at, lang)}
            >
              {t('common.edited')}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'architect',
      header: t('architect.one'),
      sortValue: (row) => architectLabel(row),
      cell: (row) => (
        <Link
          to={`/architecten/${row.architect_id}`}
          className="font-medium text-navy-900 hover:underline"
        >
          {architectLabel(row)}
        </Link>
      ),
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
      cell: (row) => <span className="text-navy-700">{row.subject}</span>,
    },
    ...(isAdmin
      ? [
          {
            key: 'agent',
            header: t('roles.agent'),
            sortValue: (row: ActivityRow) => agentName.get(row.agent_id) ?? '',
            cell: (row: ActivityRow) => agentName.get(row.agent_id) ?? '—',
          },
        ]
      : []),
    {
      key: 'followup',
      header: t('activity.followUpDate'),
      sortValue: (row) => row.follow_up_date ?? '',
      cell: (row) => {
        if (!row.follow_up_date) return <span className="text-navy-300">—</span>;
        if (row.follow_up_done) {
          return <Badge tone="green">{t('activity.followUpDone')}</Badge>;
        }
        const overdue = row.follow_up_date <= todayKey;
        return (
          <Badge tone={overdue ? 'red' : 'purple'}>
            {formatDate(row.follow_up_date, lang)}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      sortable: false,
      cell: (row) => (
        <div className="flex justify-end gap-2">
          {row.follow_up_date && !row.follow_up_done ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => markDone.mutate(row)}
            >
              {t('activity.followUpDone')}
            </Button>
          ) : null}
          {canEditActivity(row, isAdmin) ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(row);
                setDialogOpen(true);
              }}
            >
              {t('common.edit')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('activity.other')}
        search={{ value: search, onChange: setSearch }}
        action={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            {t('activity.addTitle')}
          </Button>
        }
        tabs={
          <Tabs
            items={[
              { key: 'all', label: t('common.all'), count: activities.length },
              {
                key: 'followups',
                label: t('activity.openFollowUps'),
                count: openFollowUps,
              },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-navy-500">
              {t('activity.type')}
            </span>
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-44"
            >
              <option value="">{t('common.all')}</option>
              {ACTIVITY_TYPES.map((type: ActivityType) => (
                <option key={type} value={type}>
                  {t(`activityType.${type}`)}
                </option>
              ))}
            </Select>
          </label>

          {isAdmin ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-500">
                {t('roles.agent')}
              </span>
              <Select
                value={agentFilter}
                onChange={(event) => setAgentFilter(event.target.value)}
                className="w-44"
              >
                <option value="">{t('common.all')}</option>
                {profiles
                  .filter((p) => p.role !== 'admin')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </Select>
            </label>
          ) : null}
        </div>
      </Card>

      <Card>
        {tab === 'followups' && rows.length === 0 && !isLoading ? (
          <EmptyState title={t('activity.openFollowUps')} />
        ) : (
          <>
            <CardHeader
              title={
                tab === 'followups' ? t('activity.openFollowUps') : t('activity.other')
              }
              description={t('activity.neverDeletable')}
            />
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={isLoading}
              error={error}
              search={search}
              initialSort={{ key: 'date', dir: 'desc' }}
            />
          </>
        )}
      </Card>

      <ActivityDialog
        open={dialogOpen}
        activity={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(undefined);
        }}
      />
    </>
  );
}
