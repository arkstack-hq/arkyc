import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveTenant } from '@app/http/middlewares'
import ProjectController from '@controllers/dashboard/ProjectController'
import ApiKeyController from '@controllers/dashboard/ApiKeyController'

const scoped = (perm: PermissionKey) => [auth, resolveTenant, can(perm)]

Router.group('/v1/dashboard/tenants/:tenantId/projects', () => {
    Router.get('/', [ProjectController, 'index'], scoped('projects.view'))
    Router.post('/', [ProjectController, 'create'], scoped('projects.create'))
    Router.get('/:projectId', [ProjectController, 'show'], scoped('projects.view'))
    Router.patch('/:projectId', [ProjectController, 'update'], scoped('projects.update'))

    // API keys (project-scoped)
    Router.get('/:projectId/api-keys', [ApiKeyController, 'index'], scoped('api_keys.view'))
    Router.post('/:projectId/api-keys', [ApiKeyController, 'create'], scoped('api_keys.create'))
    Router.delete('/:projectId/api-keys/:keyId', [ApiKeyController, 'destroy'], scoped('api_keys.revoke'))
})

export default () => {}
