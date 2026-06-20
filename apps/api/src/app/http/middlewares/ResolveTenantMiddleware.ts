import { AppException } from '@arkstack/common'
import type { NextFunction, Request, Response } from 'express'
import { Tenant } from '@app/models/Tenant'
import { TenantMember } from '@app/models/TenantMember'

const param = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v

/**
 * Resolves the active tenant from the route (`:tenantId`) and verifies that the
 * authenticated user is an active member of it. Must run after the `auth`
 * middleware. Attaches `req.tenant` and `req.tenantMember`.
 */
export class ResolveTenantMiddleware {
    async handler (req: Request, _res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.authUser
            if (!user) throw new AppException('Unauthenticated', 401)

            const tenantId = param(req.params.tenantId)
            const tenant = tenantId ? await Tenant.where({ id: tenantId }).first() : null
            if (!tenant) throw new AppException('Tenant not found', 404)

            const member = await TenantMember.where({
                userId: user.id,
                tenantId: tenant.id,
            }).first()
            if (!member || member.status !== 'active') {
                throw new AppException('You are not a member of this tenant', 403)
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
