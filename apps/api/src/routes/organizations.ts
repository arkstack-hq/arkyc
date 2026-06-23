import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveOrganization } from '@app/http/middlewares'
import OrganizationController from '@controllers/dashboard/OrganizationController'

const scoped = (perm: PermissionKey) => [auth, resolveOrganization, can(perm)]

Router.group('/v1/dashboard/organizations', () => {
  Router.get('/', [OrganizationController, 'index'], [auth])
  Router.post('/', [OrganizationController, 'create'], [auth])
  Router.get('/:organizationId', [OrganizationController, 'show'], scoped('organizations.view'))
  Router.patch('/:organizationId', [OrganizationController, 'update'], scoped('organizations.update'))
})

export default () => {}
