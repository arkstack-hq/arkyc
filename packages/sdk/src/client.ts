import { type VerifyWebhookInput, WebhookSigner } from '@arkyc/webhooks'
import { ArkycApiError } from './errors'
import type {
  ArkycOptions,
  CreateSessionParams,
  CreatedSession,
  VerificationSession,
} from './types'

const DEFAULT_BASE_URL = 'https://api.arkyc.dev'

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
  private readonly secretKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ArkycOptions) {
    if (!options.secretKey) throw new Error('Arkyc requires a `secretKey`.')

    this.secretKey = options.secretKey
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  /** Verification session operations. */
  readonly sessions = {
    /**
     * Open a session and receive its one-time client token for the widget.
     *
     * @param params
     * @returns
     */
    create: async (params: CreateSessionParams = {}): Promise<CreatedSession> => {
      const body = await this.request('POST', '/v1/sessions', {
        user_reference: params.userReference ?? null,
        metadata: params.metadata ?? null,
      })

      return {
        session: body.data as VerificationSession,
        clientToken: body.client_token as string,
      }
    },

    /**
     * Fetch a session by id.
     *
     * @param id
     * @returns
     */
    retrieve: async (id: string): Promise<VerificationSession> => {
      const body = await this.request('GET', `/v1/sessions/${encodeURIComponent(id)}`)

      return body.data as VerificationSession
    },

    /**
     * Cancel a non-terminal session.
     *
     * @param id
     * @returns
     */
    cancel: async (id: string): Promise<VerificationSession> => {
      const body = await this.request('POST', `/v1/sessions/${encodeURIComponent(id)}/cancel`)

      return body.data as VerificationSession
    },
  }

  /**
   * Webhook helpers.
   */
  readonly webhooks = {
    /**
     * Verify a received webhook signature against the endpoint's signing secret.
     *
     * @param input
     * @returns
     */
    verify: (input: VerifyWebhookInput): boolean => WebhookSigner.verify(input),
  }

  /**
   * Issue an authenticated request and unwrap the `{ status, data, … }` envelope.
   *
   * @param method
   * @param path
   * @param body
   * @returns
   */
  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
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
