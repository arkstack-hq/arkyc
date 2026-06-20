import { ApiKey } from '@app/models/ApiKey'
import ApiKeyCollection from '@app/http/resources/ApiKeyCollection'
import ApiKeyResource from '@app/http/resources/ApiKeyResource'
import { BaseController } from '@controllers/BaseController'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import { generateApiKey } from '@arkyc/auth'

export default class ApiKeyController extends BaseController {
  /**
   * List a project's API keys (never the secret hash).
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.tenant`).
   * @returns      An ApiKeyCollection.
   */
  async index ({ req }: HttpContext) {
    const project = await Project.where({ id: req.params.projectId, tenantId: req.tenant!.id })
      .with('apiKeys')
      .firstOrFail()

    return new ApiKeyCollection(project.getAttribute('apiKeys')).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Mint an API key; the plaintext secret is returned exactly once.
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.tenant`).
   * @returns      An ApiKeyResource plus the one-time `secret` (HTTP 201).
   */
  async create ({ req }: HttpContext) {
    const project = await Project.where({ id: req.params.projectId, tenantId: req.tenant!.id }).firstOrFail()
    const data = await this.validate({ name: ['required', 'string', 'min:2'] })

    const generated = generateApiKey(project.environment === 'production' ? 'live' : 'test')
    const key = await ApiKey.create({
      tenantId: project.tenantId,
      projectId: project.id,
      name: data.name,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
    })

    return new ApiKeyResource(key)
      .additional({
        status: 'success',
        message: 'API key created — store the secret now; it will not be shown again',
        code: 201,
        secret: generated.secret,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Revoke an API key (sets `revoked_at`).
   *
   * @param   ctx  The HTTP context (`:projectId`, `:keyId`, `req.tenant`).
   * @returns      The revoked ApiKeyResource.
   */
  async destroy ({ req }: HttpContext) {
    const project = await Project.where({ id: req.params.projectId, tenantId: req.tenant!.id }).firstOrFail()
    const key = await ApiKey.where({
      id: req.params.keyId,
      projectId: project.id,
    }).firstOrFail()

    key.revokedAt = new Date()
    await key.save()

    return new ApiKeyResource(key)
      .additional({
        status: 'success',
        message: 'API key revoked',
        code: 200
      })
  }
}
