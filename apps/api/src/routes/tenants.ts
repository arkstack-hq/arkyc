import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveTenant } from '@app/http/middlewares'
import TenantController from '@controllers/dashboard/TenantController'

const scoped = (perm: PermissionKey) => [auth, resolveTenant, can(perm)]

Router.group('/v1/dashboard/tenants', () => {
  Router.get('/', [TenantController, 'index'], [auth])
  Router.post('/', [TenantController, 'create'], [auth])
  Router.get('/:tenantId', [TenantController, 'show'], scoped('tenants.view'))
  Router.patch('/:tenantId', [TenantController, 'update'], scoped('tenants.update'))
})

export default () => {}
