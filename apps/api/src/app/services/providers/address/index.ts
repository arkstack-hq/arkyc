import type { AddressConfig, AddressVerifier } from './types'
import { LiveAddressVerifier } from './live'
import { MockAddressVerifier } from './mock'

/**
 * Address verification (opt-in stage). Verifiers (`mock`, `live`) share the
 * {@link AddressVerifier} interface; {@link AddressVerifierFactory} selects one
 * from config so call sites stay driver-agnostic. The `live` verifier corroborates
 * the user's address via openrouteservice (forward geocoding) and Nominatim
 * (reverse geocoding from device location).
 *
 * NOTE: this lives in the API rather than a `@arkyc/address` package — it's
 * server-only — but mirrors the `@arkyc/liveness` driver/factory shape so it can
 * be extracted later with no call-site changes.
 */
export class AddressVerifierFactory {
  static create(config: AddressConfig): AddressVerifier {
    switch (config.driver) {
      case 'mock':
        return new MockAddressVerifier()
      case 'live':
        return new LiveAddressVerifier(config)
      default:
        throw new Error(`Unknown address driver: ${(config as AddressConfig).driver}`)
    }
  }
}

export type { AddressConfig, AddressDriverName, AddressRequest, AddressVerifier } from './types'
export { formatAddress } from './types'
export { MockAddressVerifier } from './mock'
export { LiveAddressVerifier } from './live'
