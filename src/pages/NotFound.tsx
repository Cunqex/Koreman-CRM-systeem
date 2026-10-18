import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, EmptyState } from '@/components/ui';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardBody>
        <EmptyState
          title={t('errors.notFoundTitle')}
          description={t('errors.notFoundBody')}
          action={
            <Link
              to="/"
              className="text-sm font-medium text-accent-blue hover:underline"
            >
              {t('nav.dashboard')}
            </Link>
          }
        />
      </CardBody>
    </Card>
  );
}
