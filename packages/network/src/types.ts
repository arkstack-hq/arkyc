/** What is known about an IP address. */
export interface NetworkInfo {
  ip: string
  /** Uppercase ISO alpha-2 country, when the address resolves to one. */
  country: string | null
  /** Autonomous system number and its owner, when known. */
  asn: number | null
  organization: string | null
  vpn: boolean
  tor: boolean
  /** A datacenter or cloud provider rather than a residential or mobile network. */
  hosting: boolean
  proxy: boolean
}

/** A pluggable IP intelligence provider. */
export interface NetworkDriver {
  readonly name: string
  lookup(ip: string): Promise<NetworkInfo>
}

export type NetworkDriverName = 'mock' | 'maxmind'

export interface NetworkConfig {
  driver: NetworkDriverName
  /** GeoLite2 or GeoIP2 Country/City database path. */
  countryDatabase?: string
  /** GeoLite2 or GeoIP2 ASN database path. */
  asnDatabase?: string
  /** GeoIP2 Anonymous IP database path (commercial), for VPN, proxy and hosting flags. */
  anonymousIpDatabase?: string
  /** A newline-separated list of Tor exit addresses, e.g. the Tor Project's bulk exit list. */
  torExitList?: string
}

/**
 * Whether an address is private, loopback or link-local, which no IP database
 * can say anything useful about.
 *
 * @param ip
 * @returns
 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/, '')
  if (/^(10\.|127\.|192\.168\.|169\.254\.|0\.)/.test(v4)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v4)) return true

  return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80:/i.test(ip)
}

/** An empty lookup result for `ip`. */
export function unknownNetwork(ip: string): NetworkInfo {
  return { ip, country: null, asn: null, organization: null, vpn: false, tor: false, hosting: false, proxy: false }
}
