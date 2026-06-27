import type { NextFunction, Request, Response } from 'express'
import { ApiKey as ApiKeyAuth } from '@arkyc/auth'
import { ApiKey } from '@app/models/ApiKey'
import { ApiException } from 'src/support/apiErrors'

function readSecret(req: Request): string | null {
  const auth = req.headers.authorization
  const bearer = Array.isArray(auth) ? auth[0] : auth
  if (bearer?.startsWith('Bearer ')) return bearer.substring(7)
  const header = req.headers['x-api-key']
  const value = Array.isArray(header) ? header[0] : header

  return value || null
}

/**
 * Authenticates a request from an integrating backend using a project secret
 * API key (`Authorization: Bearer sk_…` or `X-Api-Key`). Resolves the organization +
 * project from the key and attaches `req.projectContext`.
 */
export class ApiKeyMiddleware {
  async handler(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const secret = readSecret(req)
      if (!secret) throw new ApiException('missing_api_key')

      const key = await ApiKey.where({ keyPrefix: ApiKeyAuth.prefix(secret) }).first()
      const expired = key?.expiresAt != null && new Date(key.expiresAt).getTime() <= Date.now()
      if (!key || key.revokedAt || expired || !ApiKeyAuth.verify(secret, key.keyHash)) {
        throw new ApiException('invalid_api_key')
      }

      req.projectContext = {
        organization_id: key.organizationId,
        project_id: key.projectId,
        api_key_id: key.id,
      }

      key.lastUsedAt = new Date()
      await key.save()

      next()
    } catch (error) {
      next(error)
    }
  }
}

export const apiKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => new ApiKeyMiddleware().handler(req, res, next)
