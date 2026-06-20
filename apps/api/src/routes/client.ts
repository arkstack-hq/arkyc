import { HttpContext } from 'clear-router/types/express'
import { Resource } from 'resora'
import { Router } from '@arkstack/driver-express'
import { clientTokenAuth } from '@app/http/middlewares'

// Client/Widget API (short-lived client token). The full widget flow lands in
// Phase 6; this confirms the token resolves its verification session.
Router.get(
    '/v1/client/session',
    ({ req }: HttpContext) =>
        new Resource({
            id: req.verificationSession?.id,
            status: req.verificationSession?.status,
        }).additional({ status: 'success', message: 'OK', code: 200 }),
    [clientTokenAuth],
)

export default () => {}
