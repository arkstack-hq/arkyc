import { RequestException } from '@arkstack/common'
import type { NextFunction, Request, Response } from 'express'
import { PermissionDeniedError, Permissions } from '@arkyc/permissions'
import type { AdminPermissionKey, PermissionKey } from '@arkyc/types'
import { permissionStore } from '@app/services/ArkormPermissionStore'

const param = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value)

/**
 * Enforces that the authenticated user holds `permission` in the active
 * organization/project scope. Resolves effective permissions via the Arkormˣ store
 * and denies with 403 when missing. Run after `auth` (+ `resolveOrganization` for the
 * organization scope).
 */
export class AuthorizeMiddleware {
  constructor(private readonly permission: PermissionKey) {}

  async handler(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.authUser
      RequestException.assertFound(user, 'Unauthenticated', 401)

      // Account-standing gate: a suspended user is fully blocked; a restricted
      // user is read-only, so only `*.view` permissions are allowed through.
      const status = (user as { status?: string }).status
      if (status === 'suspended') {
        next(new RequestException('Your account has been suspended.', 403))

        return
      }
      if (status === 'restricted' && !this.permission.endsWith('.view')) {
        next(new RequestException('Your account is restricted to read-only access.', 403))

        return
      }

      const organizationId = req.organization?.id ?? param(req.params.organizationId)
      RequestException.assertFound(organizationId, 'Missing organization scope', 400)
      const projectId = param(req.params.projectId) ?? null

      await Permissions.authorize({ userId: user.id, organizationId, projectId }, this.permission, permissionStore)
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

/**
 * Enforces that the authenticated user holds a platform-admin `permission`. This
 * is an entirely separate scope from {@link AuthorizeMiddleware}: there is NO
 * organization requirement, and an organization role can never grant admin access. Run after
 * `auth` only — no `resolveOrganization`.
 */
export class AdminAuthorizeMiddleware {
  constructor(private readonly permission: AdminPermissionKey) {}

  async handler(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.authUser
      RequestException.assertFound(user, 'Unauthenticated', 401)

      await Permissions.authorizeAdmin({ userId: user.id }, this.permission, permissionStore)
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

/** Route guard factory for the platform-admin scope: `canAdmin('admin.settings.view')`. */
export const canAdmin =
  (permission: AdminPermissionKey) =>
  (req: Request, res: Response, next: NextFunction): Promise<void> =>
    new AdminAuthorizeMiddleware(permission).handler(req, res, next)
