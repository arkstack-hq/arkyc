import type { FaceMatchResultData } from '@arkyc/types'
import type { FaceMatchConfig, FaceMatchDriver, FaceMatchRequest } from '../types'

/**
 * Generic HTTP face-match driver: POSTs both base64 images to a configured
 * endpoint and expects a {@link FaceMatchResultData}-shaped JSON response.
 */
export class ExternalFaceMatchDriver implements FaceMatchDriver {
  readonly name = 'external'

  constructor(private readonly config: FaceMatchConfig) {
    if (!config.endpoint) throw new Error('ExternalFaceMatchDriver requires config.endpoint')
  }

  async compare(request: FaceMatchRequest): Promise<FaceMatchResultData> {
    const res = await fetch(this.config.endpoint as string, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        documentPortrait: Buffer.from(request.documentPortrait).toString('base64'),
        selfie: Buffer.from(request.selfie).toString('base64'),
      }),
    })

    if (!res.ok) {
      throw new Error(`ExternalFaceMatchDriver request failed with status ${res.status}`)
    }

    return (await res.json()) as FaceMatchResultData
  }
}
