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
const PHASE_4 = 'fase 4 (architecten)';
const PHASE_5 = 'fase 5 (activiteiten)';
const PHASE_6 = 'fase 6 (orders en commissie)';
const PHASE_7 = 'fase 7 (contracten en claims)';
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

                <Route path="architecten" element={<Placeholder titleKey="architect.other" phase={PHASE_4} />} />
                <Route path="architecten/nieuw" element={<Placeholder titleKey="architect.newTitle" phase={PHASE_4} />} />
                <Route path="architecten/:architectId" element={<Placeholder titleKey="architect.one" phase={PHASE_4} />} />

                <Route path="activiteiten" element={<Placeholder titleKey="activity.other" phase={PHASE_5} />} />

                <Route path="projecten" element={<Placeholder titleKey="project.other" phase={PHASE_4} />} />
                <Route path="projecten/:projectId" element={<Placeholder titleKey="project.one" phase={PHASE_4} />} />

                <Route path="orders" element={<Placeholder titleKey="order.other" phase={PHASE_6} />} />
                <Route path="orders/nieuw" element={<Placeholder titleKey="order.newTitle" phase={PHASE_6} />} />
                <Route path="orders/:orderId" element={<Placeholder titleKey="order.one" phase={PHASE_6} />} />

                <Route path="commissie" element={<Placeholder titleKey="commission.ledger" phase={PHASE_6} />} />

                <Route
                  path="contracten"
                  element={
                    <RoleGate allow={['admin']}>
                      <Placeholder titleKey="contract.other" phase={PHASE_7} />
                    </RoleGate>
                  }
                />
                <Route
                  path="mijn-contract"
                  element={
                    <RoleGate allow={['agent', 'subagent']}>
                      <Placeholder titleKey="nav.myContract" phase={PHASE_7} />
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
                      <Placeholder titleKey="collection.other" phase={PHASE_6} />
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
