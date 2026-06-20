import type { NextFunction, Request, Response } from 'express'
import { PermissionDeniedError, authorize } from '@arkyc/permissions'

import type { PermissionKey } from '@arkyc/types'
import { failure } from 'src/support/responses'
import { permissionStore } from '@app/services/ArkormPermissionStore'

/**
 * Enforces that the authenticated user holds `permission` in the active
 * tenant/project scope. Resolves effective permissions via the Arkormˣ store
 * and denies with 403 when missing. Run after `auth` (+ `resolveTenant` for the
 * tenant scope).
 */
export class AuthorizeMiddleware {
  constructor(private readonly permission: PermissionKey) { }

  async handler (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.authUser
      if (!user) {
        failure(res, 401, 'Unauthenticated')

        return
      }

      const param = (value: string | string[] | undefined): string | undefined =>
        Array.isArray(value) ? value[0] : value

      const tenantId = req.tenant?.id ?? param(req.params.tenantId)
      if (!tenantId) {
        failure(res, 400, 'Missing tenant scope')

        return
      }
      const projectId = param(req.params.projectId) ?? null

      await authorize({ userId: user.id, tenantId, projectId }, this.permission, permissionStore)
      next()
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        failure(res, 403, error.message)

        return
      }
      next(error)
    }
  }
}

/** Route guard factory: `can('sessions.view')`. */
export const can =
  (permission: PermissionKey) =>
    (req: Request, res: Response, next: NextFunction): Promise<void> =>
      new AuthorizeMiddleware(permission).handler(req, res, next)
