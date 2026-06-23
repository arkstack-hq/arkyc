import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveOrganization } from '@app/http/middlewares'
import RoleController from '@controllers/dashboard/RoleController'
import PermissionController from '@controllers/dashboard/PermissionController'

const scoped = (perm: PermissionKey) => [auth, resolveOrganization, can(perm)]

Router.group('/v1/dashboard/organizations/:organizationId', () => {
  Router.get('/permissions', [PermissionController, 'index'], scoped('settings.view'))

  Router.get('/roles', [RoleController, 'index'], scoped('settings.view'))
  Router.post('/roles', [RoleController, 'create'], scoped('settings.update'))
  Router.get('/roles/:roleId', [RoleController, 'show'], scoped('settings.view'))
  Router.patch('/roles/:roleId', [RoleController, 'update'], scoped('settings.update'))
})

export default () => {}
