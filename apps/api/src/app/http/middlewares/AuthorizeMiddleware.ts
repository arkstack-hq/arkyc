import { RequestException } from '@arkstack/common'
import type { NextFunction, Request, Response } from 'express'
import { PermissionDeniedError, Permissions } from '@arkyc/permissions'
import type { PermissionKey } from '@arkyc/types'
import { permissionStore } from '@app/services/ArkormPermissionStore'

const param = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/**
 * Enforces that the authenticated user holds `permission` in the active
 * tenant/project scope. Resolves effective permissions via the Arkormˣ store
 * and denies with 403 when missing. Run after `auth` (+ `resolveTenant` for the
 * tenant scope).
 */
export class AuthorizeMiddleware {
  constructor(private readonly permission: PermissionKey) {}

  async handler(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.authUser
      RequestException.assertFound(user, 'Unauthenticated', 401)

      const tenantId = req.tenant?.id ?? param(req.params.tenantId)
      RequestException.assertFound(tenantId, 'Missing tenant scope', 400)
      const projectId = param(req.params.projectId) ?? null

      await Permissions.authorize(
        { userId: user.id, tenantId, projectId },
        this.permission,
        permissionStore,
      )
      next()
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        next(new RequestException(error.message, 403))

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
