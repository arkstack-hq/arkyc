import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import { canAdmin } from '@app/http/middlewares'
import AdminController from '@controllers/admin/AdminController'
import SettingsController from '@controllers/admin/SettingsController'
import AdminOrganizationController from '@controllers/admin/OrganizationController'
import AdminUserController from '@controllers/admin/UserController'
import AdminAuditLogController from '@controllers/admin/AuditLogController'
import AdminExtendedAccessController from '@controllers/admin/ExtendedAccessController'
import AdminStatsController from '@controllers/admin/StatsController'

// Platform-admin surface, above organizations. Guarded by `canAdmin(...)` after `auth`
// only — NO `resolveOrganization`; an organization role never grants admin access.
Router.group('/v1/admin', () => {
  // The caller's own admin standing — `auth` only (empty for non-admins).
  Router.get('/me', [AdminController, 'me'], [auth])

  // Platform-wide overview statistics.
  Router.get('/stats', [AdminStatsController, 'index'], [auth, canAdmin('admin.organizations.view')])

  Router.get('/settings', [SettingsController, 'show'], [auth, canAdmin('admin.settings.view')])
  Router.patch('/settings', [SettingsController, 'update'], [auth, canAdmin('admin.settings.update')])

  // Read-only runtime-config snapshot (secret-safe) for spotting config drift.
  Router.get('/config', [SettingsController, 'environment'], [auth, canAdmin('admin.settings.view')])

  Router.get('/organizations', [AdminOrganizationController, 'index'], [auth, canAdmin('admin.organizations.view')])
  Router.get(
    '/organizations/:organizationId',
    [AdminOrganizationController, 'show'],
    [auth, canAdmin('admin.organizations.view')],
  )
  Router.get(
    '/organizations/:organizationId/projects',
    [AdminOrganizationController, 'projects'],
    [auth, canAdmin('admin.organizations.view')],
  )

  Router.get('/users', [AdminUserController, 'index'], [auth, canAdmin('admin.users.view')])
  Router.get('/users/:userId', [AdminUserController, 'show'], [auth, canAdmin('admin.users.view')])
  Router.post('/users/:userId/admin', [AdminUserController, 'grantAdmin'], [auth, canAdmin('admin.users.manage')])
  Router.delete('/users/:userId/admin', [AdminUserController, 'revokeAdmin'], [auth, canAdmin('admin.users.manage')])
  Router.post('/users/:userId/status', [AdminUserController, 'setStatus'], [auth, canAdmin('admin.users.manage')])
  Router.post('/users/:userId/password', [AdminUserController, 'resetPassword'], [auth, canAdmin('admin.users.manage')])

  // Extended access (gated capabilities: see `support/access`).
  Router.get(
    '/extended-access',
    [AdminExtendedAccessController, 'index'],
    [auth, canAdmin('admin.extended_access.view')],
  )
  Router.get(
    '/extended-access/count',
    [AdminExtendedAccessController, 'count'],
    [auth, canAdmin('admin.extended_access.view')],
  )
  Router.get(
    '/extended-access/projects/:projectId',
    [AdminExtendedAccessController, 'project'],
    [auth, canAdmin('admin.extended_access.view')],
  )
  Router.post(
    '/extended-access/grant',
    [AdminExtendedAccessController, 'grant'],
    [auth, canAdmin('admin.extended_access.manage')],
  )
  Router.post(
    '/extended-access/revoke',
    [AdminExtendedAccessController, 'revoke'],
    [auth, canAdmin('admin.extended_access.manage')],
  )

  Router.get('/audit-logs', [AdminAuditLogController, 'index'], [auth, canAdmin('admin.audit.view')])
})

export default () => {}
