import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveOrganization } from '@app/http/middlewares'
import OrganizationController from '@controllers/dashboard/OrganizationController'
import BusinessVerificationController from '@controllers/dashboard/BusinessVerificationController'

const scoped = (perm: PermissionKey) => [auth, resolveOrganization, can(perm)]

Router.group('/v1/dashboard/organizations', () => {
  Router.get('/', [OrganizationController, 'index'], [auth])
  Router.post('/', [OrganizationController, 'create'], [auth])
  Router.get('/:organizationId', [OrganizationController, 'show'], scoped('organizations.view'))
  Router.patch('/:organizationId', [OrganizationController, 'update'], scoped('organizations.update'))
  Router.delete('/:organizationId', [OrganizationController, 'destroy'], scoped('organizations.delete'))
  Router.get('/:organizationId/verification', [BusinessVerificationController, 'show'], scoped('organizations.view'))
  Router.post(
    '/:organizationId/verification',
    [BusinessVerificationController, 'submit'],
    scoped('organizations.update'),
  )
  Router.get(
    '/:organizationId/verification/documents/:kind',
    [BusinessVerificationController, 'document'],
    scoped('organizations.view'),
  )
})

export default () => {}
