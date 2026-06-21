import { HttpContext } from 'clear-router/types/express'
import { Resource } from 'resora'
import { Router } from '@arkstack/driver-express'
import { apiKeyAuth } from '@app/http/middlewares'
import SessionController from '@controllers/public/SessionController'

// Public Project API (secret API key `Bearer sk_…` / `X-Api-Key`).

// Health check: confirms the key authenticates and resolves a project.
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

// Verification sessions.
Router.group('/v1/sessions', () => {
  Router.post('/', [SessionController, 'create'], [apiKeyAuth])
  Router.get('/:id', [SessionController, 'show'], [apiKeyAuth])
  Router.post('/:id/cancel', [SessionController, 'cancel'], [apiKeyAuth])
})

export default () => {}
