import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useSession } from './SessionProvider';
import { ErrorState } from '@/components/ui';
import type { UserRole } from '@/types/database';

function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <span className="flex items-center gap-2 text-sm text-navy-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </span>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session, profile, needsMfa } = useSession();
  const location = useLocation();

  if (loading) return <FullPageLoader />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // A deactivated account keeps its data but cannot use the portal.
  if (profile && !profile.is_active) {
    return <Navigate to="/login?reden=gedeactiveerd" replace />;
  }

  // Admins are pushed to MFA enrolment or verification until the token is aal2;
  // the admin RLS policies also require aal2, so nothing would load anyway.
  if (needsMfa) return <Navigate to="/mfa" replace />;

  return <>{children}</>;
}

/** Second line of defence only; the database decides what is actually readable. */
export function RoleGate({
  allow,
  children,
}: {
  allow: UserRole[];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { role } = useSession();

  if (!role) return null;
  if (!allow.includes(role)) {
    return (
      <ErrorState
        title={t('errors.forbiddenTitle')}
        description={t('errors.forbiddenBody')}
      />
    );
  }
  return <>{children}</>;
}
