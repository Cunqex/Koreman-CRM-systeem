import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui';
import { ArchitectForm } from './ArchitectForm';

export function NewArchitectPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t('architect.newTitle')}
        description={t('architect.regionNote')}
      />
      <ArchitectForm />
    </>
  );
}
