import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useProfiles } from '@/features/architects/queries';
import { useContracts } from '@/features/contracts/queries';
import { formatDate, percent } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { ContractRow } from '@/types/database';
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  type Column,
} from '@/components/ui';

export function ContractsPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: contracts = [], isLoading, error } = useContracts();
  const { data: profiles = [] } = useProfiles();

  const agent = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const columns: Column<ContractRow>[] = [
    {
      key: 'agent',
      header: t('roles.agent'),
      sortValue: (row) => agent.get(row.agent_id)?.full_name ?? '',
      cell: (row) => {
        const profile = agent.get(row.agent_id);
        return (
          <div>
            <p className="font-medium text-navy-900">{profile?.full_name ?? '—'}</p>
            {profile ? (
              <p className="text-xs text-navy-400">{t(`roles.${profile.role}`)}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'period',
      header: t('contract.startDate'),
      sortValue: (row) => row.start_date,
      cell: (row) => (
        <span>
          {formatDate(row.start_date, lang)} —{' '}
          {row.end_date ? (
            formatDate(row.end_date, lang)
          ) : (
            <span className="text-navy-300">…</span>
          )}
        </span>
      ),
    },
    {
      key: 'own',
      header: t('contract.ownCommissionPct'),
      align: 'right',
      sortValue: (row) => Number(row.own_commission_pct),
      cell: (row) => percent(row.own_commission_pct),
    },
    {
      key: 'transferred',
      header: t('contract.transferredCommissionPct'),
      align: 'right',
      sortValue: (row) => Number(row.transferred_commission_pct),
      cell: (row) => percent(row.transferred_commission_pct),
    },
    {
      key: 'passthrough',
      header: t('contract.subagentOwnPct'),
      align: 'right',
      sortValue: (row) => Number(row.subagent_own_pct ?? 0),
      cell: (row) =>
        row.subagent_own_pct === null ? (
          <span className="text-navy-300">—</span>
        ) : (
          percent(row.subagent_own_pct)
        ),
    },
    {
      key: 'tolerance',
      header: t('contract.priceTolerancePct'),
      align: 'right',
      sortValue: (row) => Number(row.price_tolerance_pct),
      cell: (row) => percent(row.price_tolerance_pct),
    },
    {
      key: 'region',
      header: t('contract.regionClaimActive'),
      sortValue: (row) => (row.region_claim_active ? 1 : 0),
      cell: (row) =>
        row.region_claim_active ? (
          <Badge tone="green">{t('common.yes')}</Badge>
        ) : (
          <Badge tone="red">{t('common.no')}</Badge>
        ),
    },
    {
      key: 'status',
      header: t('common.status'),
      sortValue: (row) => (row.end_date ? 1 : 0),
      cell: (row) =>
        row.end_date && row.end_date < new Date().toISOString().slice(0, 10) ? (
          <Badge tone="grey">{t('projectStatus.afgerond')}</Badge>
        ) : (
          <Badge tone="blue">{t('projectStatus.lopend')}</Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('contract.other')}
        search={{ value: search, onChange: setSearch }}
        action={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/contracten/nieuw')}
          >
            {t('common.add')}
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={contracts}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          search={search}
          onRowClick={(row) => navigate(`/contracten/${row.id}`)}
          initialSort={{ key: 'agent', dir: 'asc' }}
          emptyTitle={t('contract.other')}
        />
      </Card>
    </>
  );
}
