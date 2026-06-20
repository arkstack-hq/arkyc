import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveTenant } from '@app/http/middlewares'
import MemberController from '@controllers/dashboard/MemberController'

const scoped = (perm: PermissionKey) => [auth, resolveTenant, can(perm)]

Router.group('/v1/dashboard/tenants/:tenantId', () => {
    Router.get('/members', [MemberController, 'index'], scoped('members.view'))
    Router.post('/invitations', [MemberController, 'invite'], scoped('members.invite'))

    Router.get('/members/:memberId/permissions', [MemberController, 'showPermissions'], scoped('members.view'))
    Router.patch('/members/:memberId', [MemberController, 'assignRole'], scoped('members.update'))
    Router.post('/members/:memberId/permissions', [MemberController, 'addPermission'], scoped('members.update'))
    Router.delete(
        '/members/:memberId/permissions/:permission',
        [MemberController, 'removePermission'],
        scoped('members.update'),
    )
})

export default () => {}
