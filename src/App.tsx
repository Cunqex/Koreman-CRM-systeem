import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { ProtectedRoute, RoleGate } from '@/features/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Placeholder } from '@/pages/Placeholder';
import { NotFound } from '@/pages/NotFound';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { MfaPage } from '@/pages/auth/MfaPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ArchitectsPage } from '@/pages/architects/ArchitectsPage';
import { NewArchitectPage } from '@/pages/architects/NewArchitectPage';
import { ArchitectDetailPage } from '@/pages/architects/ArchitectDetailPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { ActivitiesPage } from '@/pages/activities/ActivitiesPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { OrderFormPage } from '@/pages/orders/OrderFormPage';
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage';
import { CommissionPage } from '@/pages/commission/CommissionPage';
import { CollectionsPage } from '@/pages/admin/CollectionsPage';
import { ContractsPage } from '@/pages/admin/ContractsPage';
import { ContractEditorPage } from '@/pages/admin/ContractEditorPage';
import { MyContractPage } from '@/pages/contracts/MyContractPage';

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
const PHASE_8 = 'fase 8 (dashboards en rapporten)';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <SessionProvider>
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
                <Route index element={<Placeholder titleKey="dashboard.title" phase={PHASE_8} />} />

                <Route
                  path="agenten"
                  element={
                    <RoleGate allow={['admin']}>
                      <Placeholder titleKey="nav.agents" phase={PHASE_8} />
                    </RoleGate>
                  }
                />
                <Route
                  path="agenten/:agentId"
                  element={
                    <RoleGate allow={['admin']}>
                      <Placeholder titleKey="nav.agents" phase={PHASE_8} />
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
                      <Placeholder titleKey="nav.subagents" phase={PHASE_8} />
                    </RoleGate>
                  }
                />

                <Route
                  path="prestaties"
                  element={
                    <RoleGate allow={['admin']}>
                      <Placeholder titleKey="performance.title" phase={PHASE_8} />
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
                      <Placeholder titleKey="audit.title" phase={PHASE_8} />
                    </RoleGate>
                  }
                />

                <Route path="meldingen" element={<Placeholder titleKey="notifications.title" phase={PHASE_8} />} />
                <Route path="profiel" element={<ProfilePage />} />

                <Route path="*" element={<NotFound />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SessionProvider>
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
