import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useArchitects, useProjects } from '@/features/architects/queries';
import { formatDate } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import { ProjectStatusBadge } from '@/features/shared/badges';
import { Card, DataTable, PageHeader, type Column } from '@/components/ui';

export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading, error } = useProjects();
  const { data: architects = [] } = useArchitects();

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
      sortValue: (row) => {
        const architect = architectById.get(row.architect_id);
        return architect ? `${architect.last_name} ${architect.first_name}` : '';
      },
      cell: (row) => {
        const architect = architectById.get(row.architect_id);
        if (!architect) return '—';
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
      <PageHeader
        title={t('project.other')}
        search={{ value: search, onChange: setSearch }}
      />
      <Card>
        <DataTable
          columns={columns}
          rows={projects}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          search={search}
          onRowClick={(row) => navigate(`/architecten/${row.architect_id}`)}
          emptyTitle={t('project.other')}
        />
      </Card>
    </>
  );
}
