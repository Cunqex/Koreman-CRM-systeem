import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import {
  useContractExceptions,
  useContractRegions,
  useMyContract,
} from '@/features/contracts/queries';
import { TargetTable } from '@/features/contracts/TargetTable';
import { formatDate, percent } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui';

export function MyContractPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { profile, isSubagent } = useSession();

  const { data: contract, isLoading } = useMyContract(profile?.id);
  const { data: regions = [] } = useContractRegions(contract?.id);
  const { data: exceptions = [] } = useContractExceptions(contract?.id);

  async function download() {
    if (!contract?.contract_file_path) return;
    const { data } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.contract_file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (isLoading) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
        </CardBody>
      </Card>
    );
  }

  if (!contract) {
    return (
      <>
        <PageHeader title={t('nav.myContract')} />
        <Card>
          <CardBody>
            <EmptyState
              title={t('nav.myContract')}
              description={t('common.emptyBody')}
            />
          </CardBody>
        </Card>
      </>
    );
  }

  const terms: [string, string][] = [
    [t('contract.startDate'), formatDate(contract.start_date, lang)],
    [
      t('contract.endDate'),
      contract.end_date ? formatDate(contract.end_date, lang) : '—',
    ],
    [t('contract.ownCommissionPct'), percent(contract.own_commission_pct)],
    [
      t('contract.transferredCommissionPct'),
      percent(contract.transferred_commission_pct),
    ],
    [t('contract.priceTolerancePct'), percent(contract.price_tolerance_pct)],
    [t('contract.inactivityDays'), String(contract.inactivity_days)],
    [
      t('contract.clawbackEnabled'),
      contract.clawback_enabled ? t('common.yes') : t('common.no'),
    ],
  ];

  // Voor een subagent gelden de commissiepercentages van de hoofdagent; wat
  // hier staat is wat de hoofdagent doorgeeft.
  if (isSubagent) {
    if (contract.subagent_own_pct !== null) {
      terms.push([
        t('contract.subagentOwnPct'),
        percent(contract.subagent_own_pct),
      ]);
    }
    if (contract.subagent_transferred_pct !== null) {
      terms.push([
        t('contract.subagentTransferredPct'),
        percent(contract.subagent_transferred_pct),
      ]);
    }
  }

  return (
    <>
      <PageHeader
        title={t('nav.myContract')}
        action={
          contract.contract_file_path ? (
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={() => void download()}
            >
              {t('contract.contractFile')}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('contract.one')} />
          <CardBody>
            <dl className="divide-y divide-line">
              {terms.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-sm text-navy-400">{label}</dt>
                  <dd className="text-sm font-medium tabular-nums text-navy-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {isSubagent ? (
              <p className="mt-3 text-xs text-navy-400">
                {t('contract.subagentPctHint')}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('contract.regions')}
            description={t('architect.regionNote')}
            action={
              contract.region_claim_active ? null : (
                <Badge tone="red">{t('contract.revokeRegion')}</Badge>
              )
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {regions.length === 0 ? (
                <p className="text-sm text-navy-400">{t('common.none')}</p>
              ) : (
                regions.map((region) => (
                  <Badge key={region.id} tone="blue">
                    {t(`province.${region.province}`)}
                  </Badge>
                ))
              )}
            </div>

            {exceptions.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-navy-700">
                  {t('contract.postcodeExceptions')}
                </p>
                <ul className="space-y-1 text-sm">
                  {exceptions.map((exception) => (
                    <li key={exception.id} className="flex items-center gap-2">
                      <Badge tone={exception.kind === 'include' ? 'green' : 'red'}>
                        {t(`contract.${exception.kind}`)}
                      </Badge>
                      <span className="tabular-nums text-navy-700">
                        {exception.postcode_from} – {exception.postcode_to}
                      </span>
                      {exception.note ? (
                        <span className="text-navy-400">· {exception.note}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title={t('contract.targets')}
          description={t('common.perContractYear')}
        />
        <TargetTable contractId={contract.id} />
      </Card>
    </>
  );
}
