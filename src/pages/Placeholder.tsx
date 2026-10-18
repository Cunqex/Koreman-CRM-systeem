import { useTranslation } from 'react-i18next';
import { Card, CardBody, EmptyState, PageHeader } from '@/components/ui';

/**
 * Temporary body for routes whose feature phase has not landed yet, so the
 * navigation and layout can be used and reviewed from phase 1 onwards.
 */
export function Placeholder({
  titleKey,
  phase,
}: {
  titleKey: string;
  phase: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(titleKey)} />
      <Card>
        <CardBody>
          <EmptyState
            title={t(titleKey)}
            description={`Deze pagina wordt gebouwd in ${phase}.`}
          />
        </CardBody>
      </Card>
    </>
  );
}
