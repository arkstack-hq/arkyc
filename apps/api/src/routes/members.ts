import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveOrganization } from '@app/http/middlewares'
import MemberController from '@controllers/dashboard/MemberController'

const scoped = (perm: PermissionKey) => [auth, resolveOrganization, can(perm)]

Router.group('/v1/dashboard/organizations/:organizationId', () => {
  // The caller's own effective permissions (any member; powers permission-aware UI).
  Router.get('/me', [MemberController, 'me'], [auth, resolveOrganization])

  Router.get('/members', [MemberController, 'index'], scoped('members.view'))
  Router.post('/invitations', [MemberController, 'invite'], scoped('members.invite'))

  Router.get('/members/:memberId/permissions', [MemberController, 'showPermissions'], scoped('members.view'))
  Router.get('/members/:memberId', [MemberController, 'show'], scoped('members.view'))
  Router.patch('/members/:memberId', [MemberController, 'assignRole'], scoped('members.update'))
  Router.post('/members/:memberId/permissions', [MemberController, 'addPermission'], scoped('members.update'))
  Router.delete(
    '/members/:memberId/permissions/:permission',
    [MemberController, 'removePermission'],
    scoped('members.update'),
  )
})

export default () => {}
