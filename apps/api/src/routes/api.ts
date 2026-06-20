import type { Request, Response } from 'express'
import { Router } from '@arkstack/driver-express'
import { auth } from '@arkstack/driver-express/middlewares'
import UserController from 'src/app/http/controllers/UserController'
import {
    acceptInvitation,
    login,
    logout,
    me,
    register,
} from 'src/app/http/controllers/AuthController'
import { apiKeyAuth, can, clientTokenAuth, resolveTenant } from '@app/http/middlewares'
import { success } from 'src/support/responses'

type Ctx = { req: Request; res: Response }

// Health check
Router.get('/', () => {
    return { status: 'OK' }
})

Router.apiResource('/users', UserController)

// ── Dashboard auth (Arkstack built-in authentication) ────────────────────────
Router.post('/v1/auth/register', register)
Router.post('/v1/auth/login', login)
Router.get('/v1/auth/me', me, [auth])
Router.post('/v1/auth/logout', logout, [auth])
Router.post('/v1/auth/invitations/accept', acceptInvitation, [auth])

// ── Dashboard API (session/JWT + tenant scope + permission) ───────────────────
Router.get(
    '/v1/dashboard/tenants/:tenantId/overview',
    ({ req, res }: Ctx) =>
        success(res, {
            tenant: { id: req.tenant?.id, name: req.tenant?.name, slug: req.tenant?.slug },
            role_id: req.tenantMember?.roleId,
        }),
    [auth, resolveTenant, can('tenants.view')],
)

// ── Public Project API (secret API key) ──────────────────────────────────────
Router.get(
    '/v1/ping/project',
    ({ req, res }: Ctx) => success(res, req.projectContext, 'Authenticated project'),
    [apiKeyAuth],
)

// ── Client/Widget API (short-lived client token) ─────────────────────────────
Router.get(
    '/v1/client/session',
    ({ req, res }: Ctx) =>
        success(res, {
            id: req.verificationSession?.id,
            status: req.verificationSession?.status,
        }),
    [clientTokenAuth],
)
