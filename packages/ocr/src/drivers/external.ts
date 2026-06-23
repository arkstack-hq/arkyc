import type { OcrResultData } from '@arkyc/types'
import type { OcrConfig, OcrDriver, OcrRequest } from '../types'

/**
 * Generic HTTP OCR driver: POSTs the base64 image to a configured endpoint and
 * expects an {@link OcrResultData}-shaped JSON response.
 */
export class ExternalOcrDriver implements OcrDriver {
  readonly name = 'external'

  constructor(private readonly config: OcrConfig) {
    if (!config.endpoint) throw new Error('ExternalOcrDriver requires config.endpoint')
  }

  async extract(request: OcrRequest): Promise<OcrResultData> {
    const res = await fetch(this.config.endpoint as string, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        image: Buffer.from(request.image).toString('base64'),
        backImage: request.backImage?.length ? Buffer.from(request.backImage).toString('base64') : null,
        documentType: request.documentType ?? null,
        country: request.country ?? null,
      }),
    })

    if (!res.ok) {
      throw new Error(`ExternalOcrDriver request failed with status ${res.status}`)
    }

    return (await res.json()) as OcrResultData
  }
}
