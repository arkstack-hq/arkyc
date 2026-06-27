import type { NextFunction, Request, Response } from 'express'
import { Token } from '@arkyc/auth'
import { VerificationSession } from '@app/models/VerificationSession'
import { sendApiError } from 'src/support/apiErrors'

function readToken(req: Request): string | null {
  const auth = req.headers.authorization
  const bearer = Array.isArray(auth) ? auth[0] : auth
  if (bearer?.startsWith('Bearer ')) return bearer.substring(7)
  const header = req.headers['x-client-token']
  const value = Array.isArray(header) ? header[0] : header

  return value || null
}

/**
 * Authenticates a widget request using a short-lived client token. Resolves the
 * verification session from the token's hash, rejecting expired ones, and
 * attaches `req.verificationSession`.
 */
export class ClientTokenMiddleware {
  async handler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = readToken(req)
      if (!token) return sendApiError(res, 'missing_client_token')

      const session = await VerificationSession.where({
        clientTokenHash: Token.hash(token),
      }).first()
      if (!session) return sendApiError(res, 'invalid_client_token')
      if (new Date(session.expiresAt).getTime() <= Date.now()) return sendApiError(res, 'session_expired')

      req.verificationSession = session
      next()
    } catch (error) {
      // Unexpected (e.g. DB) errors are beyond our control — let the framework render them.
      next(error)
    }
  }
}

export const clientTokenAuth = (req: Request, res: Response, next: NextFunction): Promise<void> =>
  new ClientTokenMiddleware().handler(req, res, next)
