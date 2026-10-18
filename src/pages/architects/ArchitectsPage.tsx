import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useArchitects, useProfiles } from '@/features/architects/queries';
import { useSession } from '@/features/auth/SessionProvider';
import { formatDate, relativeTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { ArchitectRow, Province } from '@/types/database';
import {
  ArchitectStatusBadge,
  ClaimBadge,
  OriginBadge,
  RegionBadge,
} from '@/features/shared/badges';
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  Select,
  type Column,
} from '@/components/ui';

const PROVINCES: Province[] = [
  'Drenthe',
  'Flevoland',
  'Friesland',
  'Gelderland',
  'Groningen',
  'Limburg',
  'Noord-Brabant',
  'Noord-Holland',
  'Overijssel',
  'Utrecht',
  'Zeeland',
  'Zuid-Holland',
];

type Filters = {
  agent: string;
  status: string;
  province: string;
  origin: string;
  region: string;
  inactive: string;
};

const EMPTY: Filters = {
  agent: '',
  status: '',
  province: '',
  origin: '',
  region: '',
  inactive: '',
};

export function ArchitectsPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const navigate = useNavigate();
  const { isAdmin } = useSession();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const { data: architects = [], isLoading, error } = useArchitects();
  const { data: profiles = [] } = useProfiles();

  const agentName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const rows = useMemo(() => {
    const now = Date.now();
    return architects.filter((a) => {
      if (filters.agent && a.agent_id !== filters.agent) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.province && a.province !== filters.province) return false;
      if (filters.origin && a.origin !== filters.origin) return false;
      if (filters.region === 'in' && !a.in_region) return false;
      if (filters.region === 'out' && a.in_region) return false;
      if (filters.inactive === 'yes') {
        // Grove filter op 60 dagen; de exacte grens per contract staat in
        // v_inactive_architects en op het dashboard.
        const last = a.last_activity_at ? Date.parse(a.last_activity_at) : 0;
        if (now - last < 60 * 86_400_000) return false;
      }
      return true;
    });
  }, [architects, filters]);

  const columns: Column<ArchitectRow>[] = [
    {
      key: 'name',
      header: t('architect.one'),
      sortValue: (row) => `${row.last_name} ${row.first_name}`,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            to={`/architecten/${row.id}`}
            className="font-medium text-navy-900 hover:underline"
          >
            {row.first_name} {row.last_name}
          </Link>
          {row.company_name ? (
            <p className="truncate text-xs text-navy-400">{row.company_name}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'city',
      header: t('architect.city'),
      sortValue: (row) => row.city ?? '',
      cell: (row) => (
        <div>
          <p>{row.city ?? '—'}</p>
          <p className="text-xs text-navy-400">
            {row.province ? t(`province.${row.province}`) : '—'}
          </p>
        </div>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'agent',
            header: t('roles.agent'),
            sortValue: (row: ArchitectRow) => agentName.get(row.agent_id) ?? '',
            cell: (row: ArchitectRow) => agentName.get(row.agent_id) ?? '—',
          },
        ]
      : []),
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
        <div className="flex flex-wrap gap-1">
          <RegionBadge inRegion={row.in_region} override={row.region_override} />
          <ClaimBadge status={row.claim_status} />
        </div>
      ),
    },
    {
      key: 'activity',
      header: t('architect.lastActivity'),
      sortValue: (row) => row.last_activity_at ?? '',
      cell: (row) =>
        row.last_activity_at ? (
          <span title={formatDate(row.last_activity_at, lang)}>
            {relativeTime(row.last_activity_at, lang)}
          </span>
        ) : (
          <span className="text-navy-300">{t('common.none')}</span>
        ),
    },
  ];

  const agents = profiles.filter((p) => p.role !== 'admin');

  return (
    <>
      <PageHeader
        title={isAdmin ? t('architect.other') : t('nav.myArchitects')}
        search={{ value: search, onChange: setSearch }}
        action={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/architecten/nieuw')}
          >
            {t('architect.newTitle')}
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 px-5 py-4">
          {isAdmin ? (
            <FilterSelect
              label={t('roles.agent')}
              value={filters.agent}
              onChange={(value) => setFilters({ ...filters, agent: value })}
              options={agents.map((a) => ({ value: a.id, label: a.full_name }))}
            />
          ) : null}

          <FilterSelect
            label={t('architect.status')}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={(['lead', 'actief', 'klant', 'inactief'] as const).map((s) => ({
              value: s,
              label: t(`architectStatus.${s}`),
            }))}
          />

          <FilterSelect
            label={t('architect.province')}
            value={filters.province}
            onChange={(value) => setFilters({ ...filters, province: value })}
            options={PROVINCES.map((p) => ({ value: p, label: t(`province.${p}`) }))}
          />

          <FilterSelect
            label={t('architect.origin')}
            value={filters.origin}
            onChange={(value) => setFilters({ ...filters, origin: value })}
            options={[
              { value: 'agent_signed', label: t('origin.agent_signed') },
              { value: 'koreman_transferred', label: t('origin.koreman_transferred') },
            ]}
          />

          <FilterSelect
            label={t('architect.inRegion')}
            value={filters.region}
            onChange={(value) => setFilters({ ...filters, region: value })}
            options={[
              { value: 'in', label: t('architect.inRegion') },
              { value: 'out', label: t('architect.outOfRegion') },
            ]}
          />

          <FilterSelect
            label={t('dashboard.inactiveArchitects')}
            value={filters.inactive}
            onChange={(value) => setFilters({ ...filters, inactive: value })}
            options={[{ value: 'yes', label: t('common.yes') }]}
          />

          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => setFilters(EMPTY)}
          >
            {t('common.reset')}
          </Button>
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
          onRowClick={(row) => navigate(`/architecten/${row.id}`)}
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyTitle={t('architect.other')}
        />
      </Card>
    </>
  );
}

function FilterSelect({
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
