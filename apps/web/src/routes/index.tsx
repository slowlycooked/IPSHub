import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingState } from '@/components/ui/LoadingState';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardView } from '@/pages/DashboardView';
import { ProvidersPage } from '@/pages/ProvidersPage';
import { NodesPage } from '@/pages/NodesPage';
import { ProfilesPage } from '@/pages/ProfilesPage';
import { LogsPage } from '@/pages/LogsPage';
import { DiagnosticsPage } from '@/pages/DiagnosticsPage';

function ProtectedLayout({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState label="Checking session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function LoginRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState label="Loading..." />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <ProtectedLayout>
            <DashboardView />
          </ProtectedLayout>
        }
      />
      <Route
        path="/providers"
        element={
          <ProtectedLayout>
            <ProvidersPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/nodes"
        element={
          <ProtectedLayout>
            <NodesPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/profiles"
        element={
          <ProtectedLayout>
            <ProfilesPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/logs"
        element={
          <ProtectedLayout>
            <LogsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/diagnostics"
        element={
          <ProtectedLayout>
            <DiagnosticsPage />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
