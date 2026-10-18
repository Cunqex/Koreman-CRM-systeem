import { useTranslation } from 'react-i18next';
import { money } from '@/lib/format';
import { useTargetProgress } from './queries';
import { Badge, EmptyState, TableSkeleton } from '@/components/ui';

/**
 * Targets worden bewust NEUTRAAL getoond: target, behaald en het verschil als
 * getallen. Geen voortgangsbalken en geen motiverende visuals — dit is een
 * contractuele vastlegging, geen scorebord.
 */
export function TargetTable({ contractId }: { contractId: string }) {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useTargetProgress(contractId);

  if (isLoading) return <TableSkeleton cols={6} rows={3} />;
  if (rows.length === 0) return <EmptyState title={t('contract.targets')} />;

  // Nieuwste contractjaar bovenaan.
  const sorted = [...rows].sort(
    (a, b) => b.contract_year - a.contract_year || a.label.localeCompare(b.label, 'nl'),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="px-5 py-3 font-semibold text-navy-700">
              {t('contract.contractYear')}
            </th>
            <th className="px-5 py-3 font-semibold text-navy-700">
              {t('contract.targetLabel')}
            </th>
            <th className="px-5 py-3 font-semibold text-navy-700">
              {t('contract.targetScope')}
            </th>
            <th className="px-5 py-3 text-right font-semibold text-navy-700">
              {t('contract.targetAmount')}
            </th>
            <th className="px-5 py-3 text-right font-semibold text-navy-700">
              {t('performance.achieved')}
            </th>
            <th className="px-5 py-3 text-right font-semibold text-navy-700">
              {t('performance.difference')}
            </th>
            <th className="px-5 py-3 font-semibold text-navy-700">
              {t('common.status')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((row) => {
            const difference = Number(row.achieved_amount) - Number(row.target_amount);
            return (
              <tr key={`${row.target_id}-${row.contract_year}`}>
                <td className="px-5 py-4 tabular-nums">{row.contract_year}</td>
                <td className="px-5 py-4 text-navy-800">{row.label}</td>
                <td className="px-5 py-4 text-navy-500">
                  {t(`targetScope.${row.scope}`)}
                </td>
                <td className="px-5 py-4 text-right tabular-nums">
                  {money(row.target_amount)}
                </td>
                <td className="px-5 py-4 text-right tabular-nums">
                  {money(row.achieved_amount)}
                </td>
                <td className="px-5 py-4 text-right tabular-nums text-navy-600">
                  {difference >= 0 ? '+' : ''}
                  {money(difference)}
                </td>
                <td className="px-5 py-4">
                  {/* Alleen een oordeel bij een afgelopen contractjaar. */}
                  {row.year_closed ? (
                    row.target_met ? (
                      <Badge tone="green">{t('performance.met')}</Badge>
                    ) : (
                      <Badge tone="grey">{t('performance.notMet')}</Badge>
                    )
                  ) : (
                    <span className="text-xs text-navy-300">
                      {t('projectStatus.lopend')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
