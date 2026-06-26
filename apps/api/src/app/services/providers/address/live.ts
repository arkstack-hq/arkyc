import type { AddressConfig, AddressRequest, AddressVerifier } from './types'
import type { AddressMethod, AddressMethodResult, AddressResultData } from '@arkyc/types'
import { aggregate, countryMatches } from './aggregate'
import { nominatimReverse, orsForward } from './geocode'

import { formatAddress } from './types'

/** Minimum geocode confidence for a `geocode_lookup` to count as passed. */
const MIN_GEOCODE_CONFIDENCE = 0.3

/**
 * Live address verifier. Runs each requested method against a real provider:
 * `geocode_lookup` forward-geocodes the claimed address (openrouteservice),
 * `device_location` reverse-geocodes the captured coordinates (Nominatim), and
 * `poa_document` is captured-only — auto-extraction isn't wired, so it routes to
 * manual review. A method that throws is recorded as a failed result rather than
 * failing the whole stage.
 */
export class LiveAddressVerifier implements AddressVerifier {
  readonly name = 'live'

  constructor(private readonly config: AddressConfig) {}

  async verify(request: AddressRequest): Promise<AddressResultData> {
    const results: AddressMethodResult[] = []
    for (const method of request.methods) {
      try {
        results.push(await this.runMethod(method, request))
      } catch (error) {
        results.push({
          method,
          passed: false,
          confidence: 0,
          note: error instanceof Error ? error.message : 'Address method failed',
          raw: null,
        })
      }
    }

    return aggregate(results)
  }

  private async runMethod(method: AddressMethod, request: AddressRequest): Promise<AddressMethodResult> {
    const countryHint = request.countryHint ?? undefined

    if (method === 'geocode_lookup') {
      const text = formatAddress(request.claimed)
      if (!text) return { method, passed: false, confidence: 0, note: 'No claimed address to look up' }

      const hit = await orsForward(this.config, text, countryHint)
      if (!hit) return { method, passed: false, confidence: 0, note: 'Address not found' }

      const countryOk = countryMatches(hit.address.country, countryHint)

      return {
        method,
        passed: countryOk && hit.confidence >= MIN_GEOCODE_CONFIDENCE,
        confidence: hit.confidence,
        resolved: hit.address,
        note: countryOk ? undefined : 'Resolved to a different country',
        raw: hit.raw,
      }
    }

    if (method === 'device_location') {
      if (!request.coords) return { method, passed: false, confidence: 0, note: 'No device location captured' }

      const hit = await nominatimReverse(this.config, request.coords.latitude, request.coords.longitude)
      if (!hit) return { method, passed: false, confidence: 0, note: 'Could not resolve device location' }

      const countryOk = countryMatches(hit.address.country, countryHint)

      return {
        method,
        passed: countryOk,
        confidence: countryOk ? 0.8 : 0.2,
        resolved: hit.address,
        note: countryOk ? undefined : 'Device is in a different country',
        raw: hit.raw,
      }
    }

    // poa_document: auto-extraction isn't wired — capture the doc and route to a
    // human (with on_fail: 'review', the default). A reviewer reads the upload.
    return { method, passed: false, confidence: 0, note: 'Proof-of-address requires manual review', raw: null }
  }
}
