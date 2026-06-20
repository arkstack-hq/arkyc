import { AppException } from '@arkstack/common'
import type { NextFunction, Request, Response } from 'express'
import { hashToken } from '@arkyc/auth'
import { VerificationSession } from '@app/models/VerificationSession'

function readToken (req: Request): string | null {
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
    async handler (req: Request, _res: Response, next: NextFunction): Promise<void> {
        try {
            const token = readToken(req)
            if (!token) throw new AppException('Missing client token', 401)

            const session = await VerificationSession.where({
                clientTokenHash: hashToken(token),
            }).first()
            if (!session) throw new AppException('Invalid client token', 401)
            if (new Date(session.expiresAt).getTime() <= Date.now()) {
                throw new AppException('Session expired', 401)
            }

            req.verificationSession = session
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const clientTokenAuth = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    new ClientTokenMiddleware().handler(req, res, next)
