import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveOrganization } from '@app/http/middlewares'
import ProjectController from '@controllers/dashboard/ProjectController'
import ProjectMemberController from '@controllers/dashboard/ProjectMemberController'
import ApiKeyController from '@controllers/dashboard/ApiKeyController'
import WebhookEndpointController from '@controllers/dashboard/WebhookEndpointController'
import AiAccessController from '@controllers/dashboard/AiAccessController'

const scoped = (perm: PermissionKey) => [auth, resolveOrganization, can(perm)]

Router.group('/v1/dashboard/organizations/:organizationId/projects', () => {
  Router.get('/', [ProjectController, 'index'], scoped('projects.view'))
  Router.post('/', [ProjectController, 'create'], scoped('projects.create'))
  Router.get('/:projectId', [ProjectController, 'show'], scoped('projects.view'))
  Router.patch('/:projectId', [ProjectController, 'update'], scoped('projects.update'))
  Router.post('/:projectId/logo', [ProjectController, 'uploadLogo'], scoped('projects.update'))

  // AI processing access (owner requests; platform admins grant/revoke)
  Router.get('/:projectId/ai-access', [AiAccessController, 'show'], scoped('projects.view'))
  Router.post('/:projectId/ai-access/request', [AiAccessController, 'request'], scoped('projects.update'))

  // Project members (project-scoped)
  Router.get('/:projectId/members', [ProjectMemberController, 'index'], scoped('members.view'))
  Router.post('/:projectId/members', [ProjectMemberController, 'store'], scoped('members.update'))
  Router.patch('/:projectId/members/:memberId', [ProjectMemberController, 'update'], scoped('members.update'))
  Router.delete('/:projectId/members/:memberId', [ProjectMemberController, 'destroy'], scoped('members.remove'))

  // API keys (project-scoped)
  Router.get('/:projectId/api-keys', [ApiKeyController, 'index'], scoped('api_keys.view'))
  Router.post('/:projectId/api-keys', [ApiKeyController, 'create'], scoped('api_keys.create'))
  Router.delete('/:projectId/api-keys/:keyId', [ApiKeyController, 'destroy'], scoped('api_keys.revoke'))

  // Webhook endpoints (project-scoped)
  Router.get('/:projectId/webhooks', [WebhookEndpointController, 'index'], scoped('webhooks.view'))
  Router.post('/:projectId/webhooks', [WebhookEndpointController, 'create'], scoped('webhooks.create'))
  Router.patch('/:projectId/webhooks/:webhookId', [WebhookEndpointController, 'update'], scoped('webhooks.update'))
  Router.delete('/:projectId/webhooks/:webhookId', [WebhookEndpointController, 'destroy'], scoped('webhooks.delete'))
  Router.post('/:projectId/webhooks/:webhookId/test', [WebhookEndpointController, 'test'], scoped('webhooks.test'))
})

export default () => {}
