import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import { canAdmin } from '@app/http/middlewares'
import AdminController from '@controllers/admin/AdminController'
import SettingsController from '@controllers/admin/SettingsController'
import AdminTenantController from '@controllers/admin/TenantController'
import AdminUserController from '@controllers/admin/UserController'
import AdminAuditLogController from '@controllers/admin/AuditLogController'

// Platform-admin surface, above tenants. Guarded by `canAdmin(...)` after `auth`
// only — NO `resolveTenant`; a tenant role never grants admin access.
Router.group('/v1/admin', () => {
  // The caller's own admin standing — `auth` only (empty for non-admins).
  Router.get('/me', [AdminController, 'me'], [auth])

  Router.get('/settings', [SettingsController, 'show'], [auth, canAdmin('admin.settings.view')])
  Router.patch(
    '/settings',
    [SettingsController, 'update'],
    [auth, canAdmin('admin.settings.update')],
  )

  Router.get('/tenants', [AdminTenantController, 'index'], [auth, canAdmin('admin.tenants.view')])

  Router.get('/users', [AdminUserController, 'index'], [auth, canAdmin('admin.users.view')])
  Router.post(
    '/users/:userId/admin',
    [AdminUserController, 'grantAdmin'],
    [auth, canAdmin('admin.users.manage')],
  )
  Router.delete(
    '/users/:userId/admin',
    [AdminUserController, 'revokeAdmin'],
    [auth, canAdmin('admin.users.manage')],
  )

  Router.get(
    '/audit-logs',
    [AdminAuditLogController, 'index'],
    [auth, canAdmin('admin.audit.view')],
  )
})

export default () => {}
