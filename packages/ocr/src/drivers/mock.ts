import type { OcrResultData } from '@arkyc/types'
import type { OcrDriver, OcrRequest } from '../types'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Deterministic OCR driver for development + tests. Returns fixed identity
 * fields; `hints` steer the confidence and expiry so a caller can drive a
 * session toward any decision.
 */
export class MockOcrDriver implements OcrDriver {
  readonly name = 'mock'

  async extract(request: OcrRequest): Promise<OcrResultData> {
    const confidence = clamp01(request.hints?.confidence ?? 0.92)

    return {
      fields: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
        dateOfBirth: '1990-01-01',
        documentNumber: 'X1234567',
        expiryDate: request.hints?.expired ? '2000-01-01' : '2035-01-01',
        nationality: request.country ?? 'GB',
      },
      confidence,
      raw: { provider: 'mock', confidence, documentType: request.documentType ?? null },
    }
  }
}
