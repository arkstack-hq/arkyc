import type { AddressMethodResult, AddressResultData } from '@arkyc/types'
import type { AddressRequest, AddressVerifier } from './types'
import { aggregate } from './aggregate'

const clamp01 = (n: number): number => (Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)))

/**
 * Deterministic address verifier for development + tests. Passes by default;
 * `hints` steer the score and verdict. Each requested method resolves to the
 * claimed address (or a fixed fallback) so the aggregate is well-formed.
 */
export class MockAddressVerifier implements AddressVerifier {
  readonly name = 'mock'

  async verify(request: AddressRequest): Promise<AddressResultData> {
    const score = clamp01(request.hints?.score ?? 0.9)
    const passed = request.hints?.passed ?? score >= 0.5
    const resolved = request.claimed ?? { country: request.countryHint ?? 'NG', city: 'Kaduna' }

    const methods: AddressMethodResult[] = request.methods.map((method) => ({
      method,
      passed,
      confidence: score,
      resolved,
      note: 'mock',
      raw: { provider: 'mock' },
    }))

    return aggregate(methods)
  }
}
