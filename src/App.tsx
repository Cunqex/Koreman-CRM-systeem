import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { ProtectedRoute, RoleGate } from '@/features/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotFound } from '@/pages/NotFound';

// Per route apart geladen: Recharts en de zwaardere overzichten zitten zo niet
// in de eerste download. Eén Suspense-grens om de router vangt ze allemaal.
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const MfaPage = lazy(() =>
  import('@/pages/auth/MfaPage').then((m) => ({ default: m.MfaPage })),
);
const UsersPage = lazy(() =>
  import('@/pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const ArchitectsPage = lazy(() =>
  import('@/pages/architects/ArchitectsPage').then((m) => ({ default: m.ArchitectsPage })),
);
const NewArchitectPage = lazy(() =>
  import('@/pages/architects/NewArchitectPage').then((m) => ({ default: m.NewArchitectPage })),
);
const ArchitectDetailPage = lazy(() =>
  import('@/pages/architects/ArchitectDetailPage').then((m) => ({ default: m.ArchitectDetailPage })),
);
const ProjectsPage = lazy(() =>
  import('@/pages/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const ActivitiesPage = lazy(() =>
  import('@/pages/activities/ActivitiesPage').then((m) => ({ default: m.ActivitiesPage })),
);
const OrdersPage = lazy(() =>
  import('@/pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })),
);
const OrderFormPage = lazy(() =>
  import('@/pages/orders/OrderFormPage').then((m) => ({ default: m.OrderFormPage })),
);
const OrderDetailPage = lazy(() =>
  import('@/pages/orders/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })),
);
const CommissionPage = lazy(() =>
  import('@/pages/commission/CommissionPage').then((m) => ({ default: m.CommissionPage })),
);
const CollectionsPage = lazy(() =>
  import('@/pages/admin/CollectionsPage').then((m) => ({ default: m.CollectionsPage })),
);
const ContractsPage = lazy(() =>
  import('@/pages/admin/ContractsPage').then((m) => ({ default: m.ContractsPage })),
);
const ContractEditorPage = lazy(() =>
  import('@/pages/admin/ContractEditorPage').then((m) => ({ default: m.ContractEditorPage })),
);
const MyContractPage = lazy(() =>
  import('@/pages/contracts/MyContractPage').then((m) => ({ default: m.MyContractPage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const AgentsPage = lazy(() =>
  import('@/pages/admin/AgentsPage').then((m) => ({ default: m.AgentsPage })),
);
const AgentDetailPage = lazy(() =>
  import('@/pages/admin/AgentDetailPage').then((m) => ({ default: m.AgentDetailPage })),
);
const PerformancePage = lazy(() =>
  import('@/pages/admin/PerformancePage').then((m) => ({ default: m.PerformancePage })),
);
const AuditLogPage = lazy(() =>
  import('@/pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const SubagentsPage = lazy(() =>
  import('@/pages/SubagentsPage').then((m) => ({ default: m.SubagentsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Routes still waiting for their feature phase. */

function RouteFallback() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-64 items-center justify-center py-16"
    >
      <span className="flex items-center gap-2 text-sm text-navy-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </span>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <SessionProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/wachtwoord-vergeten" element={<ForgotPasswordPage />} />
              <Route path="/wachtwoord-herstellen" element={<ResetPasswordPage />} />
              <Route path="/mfa" element={<MfaPage />} />

              {/* Everything below requires a session (and aal2 for admins). */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />

                <Route
                  path="agenten"
                  element={
                    <RoleGate allow={['admin']}>
                      <AgentsPage />
                    </RoleGate>
                  }
                />
                <Route
                  path="agenten/:agentId"
                  element={
                    <RoleGate allow={['admin']}>
                      <AgentDetailPage />
                    </RoleGate>
                  }
                />

                <Route path="architecten" element={<ArchitectsPage />} />
                <Route path="architecten/nieuw" element={<NewArchitectPage />} />
                <Route path="architecten/:architectId" element={<ArchitectDetailPage />} />

                <Route path="activiteiten" element={<ActivitiesPage />} />

                <Route path="projecten" element={<ProjectsPage />} />
                <Route path="projecten/:projectId" element={<ProjectsPage />} />

                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/nieuw" element={<OrderFormPage />} />
                <Route path="orders/:orderId/bewerken" element={<OrderFormPage />} />
                <Route path="orders/:orderId" element={<OrderDetailPage />} />

                <Route path="commissie" element={<CommissionPage />} />

                <Route
                  path="contracten"
                  element={
                    <RoleGate allow={['admin']}>
                      <ContractsPage />
                    </RoleGate>
                  }
                />
                <Route
                  path="contracten/:contractId"
                  element={
                    <RoleGate allow={['admin']}>
                      <ContractEditorPage />
                    </RoleGate>
                  }
                />
                <Route
                  path="mijn-contract"
                  element={
                    <RoleGate allow={['agent', 'subagent']}>
                      <MyContractPage />
                    </RoleGate>
                  }
                />
                <Route
                  path="subagenten"
                  element={
                    <RoleGate allow={['agent']}>
                      <SubagentsPage />
                    </RoleGate>
                  }
                />

                <Route
                  path="prestaties"
                  element={
                    <RoleGate allow={['admin']}>
                      <PerformancePage />
                    </RoleGate>
                  }
                />
                <Route
                  path="collecties"
                  element={
                    <RoleGate allow={['admin']}>
                      <CollectionsPage />
                    </RoleGate>
                  }
                />
                <Route
                  path="gebruikers"
                  element={
                    <RoleGate allow={['admin']}>
                      <UsersPage />
                    </RoleGate>
                  }
                />
                <Route
                  path="audit-log"
                  element={
                    <RoleGate allow={['admin']}>
                      <AuditLogPage />
                    </RoleGate>
                  }
                />

                <Route path="meldingen" element={<NotificationsPage />} />
                <Route path="profiel" element={<ProfilePage />} />

                <Route path="*" element={<NotFound />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </SessionProvider>
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
