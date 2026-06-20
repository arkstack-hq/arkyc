import type { NextFunction, Request, Response } from 'express'
import { failure } from 'src/support/responses'
import { Tenant } from '@app/models/Tenant'
import { TenantMember } from '@app/models/TenantMember'

/**
 * Resolves the active tenant from the route (`:tenantId`) and verifies that the
 * authenticated user is an active member of it. Must run after the `auth`
 * middleware. Attaches `req.tenant` and `req.tenantMember`.
 */
export class ResolveTenantMiddleware {
    async handler (req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.authUser
            if (!user) {
                failure(res, 401, 'Unauthenticated')
                
return
            }

            const tenantId = req.params.tenantId
            const tenant = tenantId ? await Tenant.where({ id: tenantId }).first() : null
            if (!tenant) {
                failure(res, 404, 'Tenant not found')
                
return
            }

            const member = await TenantMember.where({
                userId: user.id,
                tenantId: tenant.id,
            }).first()
            if (!member || member.status !== 'active') {
                failure(res, 403, 'You are not a member of this tenant')
                
return
            }

            req.tenant = tenant
            req.tenantMember = member
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const resolveTenant = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    new ResolveTenantMiddleware().handler(req, res, next)
