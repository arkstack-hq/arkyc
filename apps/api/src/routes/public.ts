import { HttpContext } from 'clear-router/types/express'
import { Resource } from 'resora'
import { Router } from '@arkstack/driver-express'
import { apiKeyAuth } from '@app/http/middlewares'

// Public Project API (secret API key). Verification session endpoints land in
// Phase 6; this confirms the key authenticates and resolves a project.
Router.get(
    '/v1/ping/project',
    ({ req }: HttpContext) =>
        new Resource(req.projectContext ?? {}).additional({
            status: 'success',
            message: 'Authenticated project',
            code: 200,
        }),
    [apiKeyAuth],
)

export default () => {}
