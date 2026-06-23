import type { CreateSessionParams, CreatedSession, VerificationSession } from "./types"

export class Sessions {
  constructor(private readonly request: (method: string, path: string, body?: unknown) => Promise<Record<string, unknown>>) { }

  /**
   * Open a session and receive its one-time client token for the widget.
   *
   * @param params
   * @returns
   */
  async create(params: CreateSessionParams = {}): Promise<CreatedSession> {
    const body = await this.request('POST', '/v1/sessions', {
      user_reference: params.userReference ?? null,
      metadata: params.metadata ?? null,
    })

    return {
      session: body.data as VerificationSession,
      clientToken: body.client_token as string,
    }
  }

  /**
   * Fetch a session by id.
   *
   * @param id
   * @returns
   */
  async retrieve(id: string): Promise<VerificationSession> {
    const body = await this.request('GET', `/v1/sessions/${encodeURIComponent(id)}`)

    return body.data as VerificationSession
  }

  /**
   * Cancel a non-terminal session.
   *
   * @param id
   * @returns
   */
  async cancel(id: string): Promise<VerificationSession> {
    const body = await this.request('POST', `/v1/sessions/${encodeURIComponent(id)}/cancel`)

    return body.data as VerificationSession
  }
}
