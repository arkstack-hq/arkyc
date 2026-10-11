import type { NextFunction, Request, Response } from 'express'

import { ApiException } from 'src/support/apiErrors'
import { clientTokens } from '@app/services/ClientTokenService'

/**
 * The client token on a widget request, from `Authorization: Bearer` or `X-Client-Token`.
 *
 * @param req
 * @returns
 */
export function readClientToken(req: Request): string | null {
  const auth = req.headers.authorization
  const bearer = Array.isArray(auth) ? auth[0] : auth
  if (bearer?.startsWith('Bearer ')) return bearer.substring(7)
  const header = req.headers['x-client-token']
  const value = Array.isArray(header) ? header[0] : header

  return value || null
}

/**
 * The request's `Origin`, present on browser cross-origin calls.
 *
 * @param req
 * @returns
 */
export function readOrigin(req: Request): string | null {
  const header = req.headers.origin
  const value = Array.isArray(header) ? header[0] : header

  return value || null
}

/**
 * Authenticates a widget request with a device client token and attaches
 * `req.verificationSession`.
 */
export class ClientTokenMiddleware {
  async handler(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = readClientToken(req)
      if (!token) throw new ApiException('missing_client_token')

      req.verificationSession = await clientTokens.authenticate(token, readOrigin(req))
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
