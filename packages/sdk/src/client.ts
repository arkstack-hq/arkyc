import { ArkycApiError } from './errors'
import type { ArkycOptions } from './types'
import { Sessions } from './Sessions'
import { Webhooks } from './Webhooks'

/**
 * Arkyc server SDK. Authenticates with a project secret key and wraps the
 * Public Project API.
 *
 * ```ts
 * const arkyc = new Arkyc({ secretKey: process.env.ARKYC_SECRET_KEY! })
 * const { session, clientToken } = await arkyc.sessions.create({ userReference: 'user_123' })
 * ```
 */
export class Arkyc {
  private static DEFAULT_BASE_URL = 'https://api.arkyc.dev'
  private readonly secretKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ArkycOptions) {
    if (!options.secretKey) throw new Error('Arkyc requires a `secretKey`.')

    this.secretKey = options.secretKey
    this.baseUrl = (options.baseUrl ?? Arkyc.DEFAULT_BASE_URL).replace(/\/$/, '')
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  /**
   * Verification session operations. `request` is bound so it keeps `this`
   * (and thus `fetchImpl`) when invoked from the Sessions helper.
   */
  readonly sessions = new Sessions(this.request.bind(this))

  /**
   * Webhook helpers.
   */
  readonly webhooks = new Webhooks()

  /**
   * Issue an authenticated request and unwrap the `{ status, data, … }` envelope.
   *
   * @param method
   * @param path
   * @param body
   * @returns
   */
  private async request(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(`${this.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      throw new ArkycApiError(
        (json.message as string) ?? `Arkyc request failed with status ${response.status}`,
        response.status,
        json.errors as Record<string, string[] | string> | undefined,
      )
    }

    return json
  }
}
