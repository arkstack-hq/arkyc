import type { NextFunction, Request, Response } from 'express'
import { hashToken } from '@arkyc/auth'
import { failure } from 'src/support/responses'
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
    async handler (req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const token = readToken(req)
            if (!token) {
                failure(res, 401, 'Missing client token')
                
return
            }

            const session = await VerificationSession.where({
                clientTokenHash: hashToken(token),
            }).first()
            if (!session) {
                failure(res, 401, 'Invalid client token')
                
return
            }
            if (new Date(session.expiresAt).getTime() <= Date.now()) {
                failure(res, 401, 'Session expired')
                
return
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
