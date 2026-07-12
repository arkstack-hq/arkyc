import type { NextFunction, Request, Response } from 'express'

import { ApiException } from 'src/support/apiErrors'
import { Token } from '@arkyc/auth'
import { Project } from '@app/models/Project'
import { VerificationSession } from '@app/models/VerificationSession'
import { isOriginAllowed } from 'src/support/origins'

function readToken(req: Request): string | null {
  const auth = req.headers.authorization
  const bearer = Array.isArray(auth) ? auth[0] : auth
  if (bearer?.startsWith('Bearer ')) return bearer.substring(7)
  const header = req.headers['x-client-token']
  const value = Array.isArray(header) ? header[0] : header

  return value || null
}

function readOrigin(req: Request): string | null {
  const header = req.headers.origin
  const value = Array.isArray(header) ? header[0] : header

  return value || null
}

/**
 * Authenticates a widget request using a short-lived client token. Resolves the
 * verification session from the token's hash, rejecting expired ones, and
 * attaches `req.verificationSession`.
 */
export class ClientTokenMiddleware {
  async handler(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = readToken(req)
      if (!token) throw new ApiException('missing_client_token')

      const session = await VerificationSession.where({
        clientTokenHash: Token.hash(token),
      }).first()

      if (!session) throw new ApiException('invalid_client_token')
      if (new Date(session.expiresAt).getTime() <= Date.now()) throw new ApiException('session_expired')

      // Opt-in per-project origin allowlist. Only enforced when the request
      // carries an `Origin` (a browser cross-origin call); non-browser/same-origin
      // callers and projects with no configured origins pass through unchanged.
      const origin = readOrigin(req)
      if (origin) {
        const project = await Project.where({ id: session.projectId }).first()
        if (!isOriginAllowed(project?.settings?.allowed_origins, origin)) {
          throw new ApiException('origin_not_allowed')
        }
      }

      req.verificationSession = session
      next()
    } catch (error) {
      // ApiException carries a stable `error` key; unexpected (e.g. DB) errors
      // fall through to the framework's generic renderer.
      next(error)
    }
  }
}

export const clientTokenAuth = (req: Request, res: Response, next: NextFunction): Promise<void> =>
  new ClientTokenMiddleware().handler(req, res, next)
