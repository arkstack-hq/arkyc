import { HttpContext } from 'clear-router/types/express'
import { Resource } from 'resora'
import { Router } from '@arkstack/driver-express'
import { apiKeyAuth, apiLimiter } from '@app/http/middlewares'
import SessionController from '@controllers/public/SessionController'
import SessionAssetController from '@controllers/public/SessionAssetController'

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
  [apiLimiter, apiKeyAuth],
)

// Verification sessions.
Router.group('/v1/sessions', () => {
  Router.post('/', [SessionController, 'create'], [apiLimiter, apiKeyAuth])
  Router.get('/:id', [SessionController, 'show'], [apiLimiter, apiKeyAuth])
  Router.post('/:id/cancel', [SessionController, 'cancel'], [apiLimiter, apiKeyAuth])
})

// Signed, time-limited session assets served inline as images (no API key — the
// HMAC signature in the query authorizes the request). Lets a third party view
// or embed captured images directly.
Router.get('/v1/session-assets/:id/:kind', [SessionAssetController, 'show'])

export default () => {}
