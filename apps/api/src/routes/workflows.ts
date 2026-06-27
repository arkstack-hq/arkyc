import { can, resolveOrganization } from '@app/http/middlewares'

import type { PermissionKey } from '@arkyc/types'
import { Router } from '@arkstack/driver-express'
import WorkflowController from '@controllers/dashboard/WorkflowController'
import { auth } from '@arkstack/driver-express/middlewares'

const scoped = (perm: PermissionKey) => [auth, resolveOrganization, can(perm)]

Router.group('/v1/dashboard/organizations/:organizationId/workflows', () => {
  Router.get('/', [WorkflowController, 'index'], scoped('workflows.view'))
  Router.post('/', [WorkflowController, 'create'], scoped('workflows.create'))
  Router.get('/:workflowId', [WorkflowController, 'show'], scoped('workflows.view'))
  Router.patch('/:workflowId', [WorkflowController, 'update'], scoped('workflows.update'))
  Router.delete('/:workflowId', [WorkflowController, 'destroy'], scoped('workflows.delete'))
})

export default () => { }
