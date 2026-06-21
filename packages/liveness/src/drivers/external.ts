import type { LivenessResultData } from '@arkyc/types'
import type { LivenessConfig, LivenessDriver, LivenessRequest } from '../types'

/**
 * Generic HTTP liveness driver: POSTs the base64 selfie to a configured
 * endpoint and expects a {@link LivenessResultData}-shaped JSON response.
 */
export class ExternalLivenessDriver implements LivenessDriver {
  readonly name = 'external'

  constructor(private readonly config: LivenessConfig) {
    if (!config.endpoint) throw new Error('ExternalLivenessDriver requires config.endpoint')
  }

  async check(request: LivenessRequest): Promise<LivenessResultData> {
    const res = await fetch(this.config.endpoint as string, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({ selfie: Buffer.from(request.selfie).toString('base64') }),
    })

    if (!res.ok) {
      throw new Error(`ExternalLivenessDriver request failed with status ${res.status}`)
    }

    return (await res.json()) as LivenessResultData
  }
}
