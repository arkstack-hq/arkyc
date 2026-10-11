import type { NetworkDriver, NetworkInfo } from '../types'
import { unknownNetwork } from '../types'

/**
 * Deterministic IP intelligence for development and tests, keyed on the RFC 5737
 * documentation ranges: `192.0.2.x` is a VPN, `198.51.100.x` a Tor exit and
 * `203.0.113.x` a hosting provider. Other addresses are clean and resolve to
 * `country`, when given.
 */
export class MockNetworkDriver implements NetworkDriver {
  readonly name = 'mock'

  constructor(private readonly country: string | null = null) {}

  async lookup(ip: string): Promise<NetworkInfo> {
    const info = { ...unknownNetwork(ip), country: this.country }

    if (ip.startsWith('192.0.2.')) return { ...info, country: 'NL', vpn: true }
    if (ip.startsWith('198.51.100.')) return { ...info, country: 'DE', tor: true }
    if (ip.startsWith('203.0.113.')) return { ...info, country: 'US', hosting: true, organization: 'Mock Cloud' }

    return info
  }
}
