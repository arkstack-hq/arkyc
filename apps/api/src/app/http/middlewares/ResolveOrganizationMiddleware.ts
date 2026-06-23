import { RequestException } from '@arkstack/common'
import type { NextFunction, Request, Response } from 'express'
import { Organization } from '@app/models/Organization'
import { OrganizationMember } from '@app/models/OrganizationMember'

const param = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

/**
 * Resolves the active organization from the route (`:organizationId`) and verifies that the
 * authenticated user is an active member of it. Must run after the `auth`
 * middleware. Attaches `req.organization` and `req.organizationMember`.
 */
export class ResolveOrganizationMiddleware {
  async handler(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.authUser
      RequestException.assertFound(user, 'Unauthenticated', 401)

      const organizationId = param(req.params.organizationId)
      const organization = organizationId ? await Organization.where({ id: organizationId }).first() : null
      RequestException.assertFound(organization, 'Organization not found', 404)

      const member = await OrganizationMember.where({
        userId: user.id,
        organizationId: organization.id,
      }).first()
      RequestException.assertFound(member, 'You are not a member of this organization', 403)
      RequestException.abortIf(member.status !== 'active', 'You are not a member of this organization', 403)

      req.organization = organization
      req.organizationMember = member
      next()
    } catch (error) {
      next(error)
    }
  }
}

export const resolveOrganization = (req: Request, res: Response, next: NextFunction): Promise<void> =>
  new ResolveOrganizationMiddleware().handler(req, res, next)
