import { readFile } from 'node:fs/promises'
import type { NetworkConfig, NetworkDriver, NetworkInfo } from '../types'
import { isPrivateAddress, unknownNetwork } from '../types'

interface Reader {
  get(ip: string): unknown
}

interface CountryRecord {
  country?: { iso_code?: string }
  registered_country?: { iso_code?: string }
}

interface AsnRecord {
  autonomous_system_number?: number
  autonomous_system_organization?: string
}

interface AnonymousIpRecord {
  is_anonymous_vpn?: boolean
  is_hosting_provider?: boolean
  is_public_proxy?: boolean
  is_residential_proxy?: boolean
  is_tor_exit_node?: boolean
}

/** Substrings of AS owner names that mark a datacenter or cloud network. */
const HOSTING_OWNERS = [
  'amazon',
  'aws',
  'google cloud',
  'microsoft',
  'azure',
  'digitalocean',
  'linode',
  'akamai',
  'ovh',
  'hetzner',
  'vultr',
  'choopa',
  'contabo',
  'scaleway',
  'oracle',
  'alibaba',
  'tencent',
  'leaseweb',
  'm247',
  'datacamp',
  'hostinger',
  'ionos',
  'cloudflare',
]

/**
 * IP intelligence from local MaxMind databases (free GeoLite2 Country and ASN,
 * or their GeoIP2 equivalents). Hosting networks are recognized from the ASN
 * owner; VPN and proxy flags need the commercial GeoIP2 Anonymous IP database,
 * and Tor exits come from an optional exit list file.
 */
export class MaxMindNetworkDriver implements NetworkDriver {
  readonly name = 'maxmind'

  private loaded?: Promise<{
    country: Reader | null
    asn: Reader | null
    anonymous: Reader | null
    tor: Set<string>
  }>

  constructor(private readonly config: NetworkConfig) {
    if (!config.countryDatabase && !config.asnDatabase) {
      throw new Error('MaxMindNetworkDriver requires a country or ASN database path')
    }
  }

  async lookup(ip: string): Promise<NetworkInfo> {
    if (isPrivateAddress(ip)) return unknownNetwork(ip)

    const db = await this.databases()
    const country = db.country?.get(ip) as CountryRecord | null
    const asn = db.asn?.get(ip) as AsnRecord | null
    const anonymous = db.anonymous?.get(ip) as AnonymousIpRecord | null
    const organization = asn?.autonomous_system_organization ?? null
    const owner = organization?.toLowerCase() ?? ''

    return {
      ip,
      country: (country?.country?.iso_code ?? country?.registered_country?.iso_code)?.toUpperCase() ?? null,
      asn: asn?.autonomous_system_number ?? null,
      organization,
      vpn: anonymous?.is_anonymous_vpn === true,
      tor: anonymous?.is_tor_exit_node === true || db.tor.has(ip),
      hosting: anonymous?.is_hosting_provider === true || HOSTING_OWNERS.some((name) => owner.includes(name)),
      proxy: anonymous?.is_public_proxy === true || anonymous?.is_residential_proxy === true,
    }
  }

  private databases() {
    this.loaded ??= (async () => {
      const maxmind = await import('maxmind').catch(() => {
        throw new Error('The maxmind driver needs the `maxmind` package installed')
      })
      const open = (path?: string) => (path ? (maxmind.open(path) as Promise<Reader>) : Promise.resolve(null))
      const tor = this.config.torExitList
        ? new Set(
            (await readFile(this.config.torExitList, 'utf8'))
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean),
          )
        : new Set<string>()

      const [country, asn, anonymous] = await Promise.all([
        open(this.config.countryDatabase),
        open(this.config.asnDatabase),
        open(this.config.anonymousIpDatabase),
      ])

      return { country, asn, anonymous, tor }
    })()

    return this.loaded
  }
}
