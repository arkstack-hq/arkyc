import { Navigate, Route, Routes } from 'react-router-dom'

import AdminAuditLogsPage from '@/pages/admin/AdminAuditLogsPage'
import { AdminLayout } from '@/components/AdminLayout'
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage'
import AdminTenantsPage from '@/pages/admin/AdminTenantsPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AuditLogsPage from '@/pages/AuditLogsPage'
import { Loading } from '@/components/States'
import LoginPage from '@/pages/LoginPage'
import MemberDetailPage from '@/pages/members/MemberDetailPage'
import MemberPermissionsPage from '@/pages/members/MemberPermissionsPage'
import MembersPage from '@/pages/members/MembersPage'
import OnboardingPage from '@/pages/OnboardingPage'
import OverviewPage from '@/pages/OverviewPage'
import PermissionsPage from '@/pages/settings/PermissionsPage'
import ProjectApiKeysPage from '@/pages/projects/ProjectApiKeysPage'
import ProjectDetailLayout from '@/pages/projects/ProjectDetailLayout'
import ProjectSettingsPage from '@/pages/projects/ProjectSettingsPage'
import ProjectWebhooksPage from '@/pages/projects/ProjectWebhooksPage'
import ProjectsPage from '@/pages/projects/ProjectsPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import RegisterPage from '@/pages/RegisterPage'
import ReviewsPage from '@/pages/ReviewsPage'
import RoleDetailPage from '@/pages/settings/RoleDetailPage'
import RolesPage from '@/pages/settings/RolesPage'
import SessionDetailPage from '@/pages/sessions/SessionDetailPage'
import SessionsPage from '@/pages/sessions/SessionsPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import { TenantLayout } from '@/components/Layout'
import { Tenants } from '@/lib/api'
import VerifyPage from '@/pages/VerifyPage'
import { useAuth } from '@/contexts/auth-context'
import { useRequest } from 'alova/client'

/** Send "/" to the first tenant's overview, or onboarding when none exist. */
function RootRedirect() {
  const { data: tenants = [], loading } = useRequest(Tenants.list(), { initialData: [] })
  if (loading) return <Loading />
  const first = tenants[0]
  return <Navigate to={first ? `/t/${first.slug}/overview` : '/onboarding'} replace />
}

export default function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user && !loading ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route path="/verify" element={<VerifyPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RootRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/t/:tenantSlug"
        element={
          <ProtectedRoute>
            <TenantLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />

        <Route path="sessions" element={<SessionsPage />} />
        <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />

        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailLayout />}>
          <Route index element={<ProjectSettingsPage />} />
          <Route path="api-keys" element={<ProjectApiKeysPage />} />
          <Route path="webhooks" element={<ProjectWebhooksPage />} />
        </Route>

        <Route path="members" element={<MembersPage />} />
        <Route path="members/:memberId" element={<MemberDetailPage />} />
        <Route path="members/:memberId/permissions" element={<MemberPermissionsPage />} />

        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/roles" element={<RolesPage />} />
        <Route path="settings/roles/:roleId" element={<RoleDetailPage />} />
        <Route path="settings/permissions" element={<PermissionsPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="settings" replace />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="tenants" element={<AdminTenantsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
