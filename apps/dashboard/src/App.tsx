import { Navigate, Route, Routes } from 'react-router-dom'

import AdminAuditLogsPage from '@/pages/admin/AdminAuditLogsPage'
import AdminExtendedAccessPage from '@/pages/admin/AdminExtendedAccessPage'
import AdminExtendedAccessReviewPage from '@/pages/admin/AdminExtendedAccessReviewPage'
import { AdminLayout } from '@/components/AdminLayout'
import AdminOrganizationDetailPage from '@/pages/admin/AdminOrganizationDetailPage'
import AdminOrganizationsPage from '@/pages/admin/AdminOrganizationsPage'
import AdminOverviewPage from '@/pages/admin/AdminOverviewPage'
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage'
import AdminUserDetailPage from '@/pages/admin/AdminUserDetailPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AuditLogsPage from '@/pages/AuditLogsPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import { Loading } from '@/components/States'
import LoginPage from '@/pages/LoginPage'
import MemberDetailPage from '@/pages/members/MemberDetailPage'
import MemberPermissionsPage from '@/pages/members/MemberPermissionsPage'
import MembersPage from '@/pages/members/MembersPage'
import OnboardingPage from '@/pages/OnboardingPage'
import { OrganizationLayout } from '@/components/Layout'
import { Organizations } from '@/lib/api'
import OverviewPage from '@/pages/OverviewPage'
import PermissionsPage from '@/pages/settings/PermissionsPage'
import ProjectApiKeysPage from '@/pages/projects/ProjectApiKeysPage'
import ProjectDetailLayout from '@/pages/projects/ProjectDetailLayout'
import ProjectExtendedAccessPage from '@/pages/projects/ProjectExtendedAccessPage'
import ProjectSettingsPage from '@/pages/projects/ProjectSettingsPage'
import ProjectWebhooksPage from '@/pages/projects/ProjectWebhooksPage'
import ProjectsPage from '@/pages/projects/ProjectsPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import RegisterPage from '@/pages/RegisterPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import ReviewsPage from '@/pages/ReviewsPage'
import RoleDetailPage from '@/pages/settings/RoleDetailPage'
import RolesPage from '@/pages/settings/RolesPage'
import SecurityPage from '@/pages/SecurityPage'
import SessionDetailPage from '@/pages/sessions/SessionDetailPage'
import SessionsPage from '@/pages/sessions/SessionsPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'
import VerifyPage from '@/pages/VerifyPage'
import WorkflowsPage from '@/pages/WorkflowsPage'
import { useAuth } from '@/contexts/auth-context'
import { useRequest } from 'alova/client'

/** Send "/" to the first organization's overview, or onboarding when none exist. */
function RootRedirect() {
  const { data: organizations = [], loading } = useRequest(Organizations.list(), { initialData: [] })
  if (loading) return <Loading />
  const first = organizations[0]
  return <Navigate to={first ? `/o/${first.slug}/overview` : '/onboarding'} replace />
}

export default function App() {
  const { user, loading } = useAuth()
  const baseUrl = 'https://app.arkyc.toneflix.net'

  return (
    <>
      <meta property="og:image" content={`${baseUrl}/arkyc-banner.png`} />
      <meta property="twitter:image" content={`${baseUrl}/arkyc-banner.png`} />
      <Routes>
        <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={user && !loading ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route
          path="/forgot-password"
          element={user && !loading ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
        />
        <Route
          path="/reset-password"
          element={user && !loading ? <Navigate to="/" replace /> : <ResetPasswordPage />}
        />
        {/* Alias for the path emitted in the server's reset email (`/auth/reset-password`). */}
        <Route
          path="/auth/reset-password"
          element={user && !loading ? <Navigate to="/" replace /> : <ResetPasswordPage />}
        />
        <Route path="/verify-email" element={user ? <VerifyEmailPage /> : <Navigate to="/login" replace />} />
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
          path="/account/security"
          element={
            <ProtectedRoute>
              <SecurityPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/o/:organizationSlug"
          element={
            <ProtectedRoute>
              <OrganizationLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />

          <Route path="sessions" element={<SessionsPage />} />
          <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />

          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailLayout />}>
            <Route index element={<ProjectSettingsPage />} />
            <Route path="api-keys" element={<ProjectApiKeysPage />} />
            <Route path="webhooks" element={<ProjectWebhooksPage />} />
            <Route path="extended-access" element={<ProjectExtendedAccessPage />} />
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
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="organizations" element={<AdminOrganizationsPage />} />
          <Route path="organizations/:organizationId" element={<AdminOrganizationDetailPage />} />
          <Route path="extended-access" element={<AdminExtendedAccessPage />} />
          <Route path="extended-access/:projectId" element={<AdminExtendedAccessReviewPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserDetailPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
