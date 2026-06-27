import type { AddressConfig } from './types'
import type { PostalAddress } from '@arkyc/types'

const ORS_URL = 'https://api.openrouteservice.org/geocode/search'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

const clamp01 = (n: number): number => (Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)))

interface OrsFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, unknown>
}

/** A forward-geocoded hit: the normalised address + the provider's confidence. */
export interface GeocodeHit {
  address: PostalAddress
  confidence: number
  /** The provider's full formatted address string (ORS `label`), when present. */
  label?: string
  raw: unknown
}

/**
 * Forward-geocode a free-text address via openrouteservice, returning the top
 * hit (or `null` when nothing matches). Requires `config.orsApiKey`.
 */
export async function orsForward(config: AddressConfig, text: string, country?: string): Promise<GeocodeHit | null> {
  if (!config.orsApiKey) throw new Error('Address geocode_lookup requires ADDRESS_ORS_API_KEY')

  const url = new URL(config.orsUrl ?? ORS_URL)
  url.searchParams.set('api_key', config.orsApiKey)
  url.searchParams.set('text', text)
  if (country) url.searchParams.set('boundary.country', country)
  url.searchParams.set('size', '1')

  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`openrouteservice geocode failed (${res.status})`)

  const data = (await res.json()) as { features?: OrsFeature[] }
  const feature = data.features?.[0]
  if (!feature) return null

  const p = feature.properties ?? {}
  const [lon, lat] = feature.geometry?.coordinates ?? []
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
  const address: PostalAddress = {
    line1: str(p.name),
    city: str(p.locality) ?? str(p.county),
    region: str(p.region),
    postalCode: str(p.postalcode),
    // Prefer the country NAME ("Nigeria"); ORS's `country_a` is alpha-3 ("NGA")
    // which won't match the user's alpha-2 input — countryMatches handles codes.
    country: str(p.country) ?? str(p.country_a),
    latitude: lat,
    longitude: lon,
  }

  return { address, confidence: clamp01(Number(p.confidence ?? 0.5)), label: str(p.label), raw: feature }
}

/**
 * Reverse-geocode coordinates to an address via Nominatim (or `null` when it
 * can't resolve). Sends the configured User-Agent per Nominatim's usage policy.
 */
export async function nominatimReverse(
  config: AddressConfig,
  lat: number,
  lon: number,
): Promise<{ address: PostalAddress; displayName?: string; raw: unknown } | null> {
  const url = new URL(`${config.nominatimUrl ?? NOMINATIM_URL}/reverse`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('layer', 'address')

  const res = await fetch(url, {
    headers: {
      'user-agent': config.userAgent ?? 'Arkyc/1.0 (address-verification)',
      accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Nominatim reverse geocode failed (${res.status})`)

  const data = (await res.json()) as { address?: Record<string, string>; display_name?: string }
  const a = data.address
  if (!a) return null

  const address: PostalAddress = {
    line1: [a.house_number, a.road].filter(Boolean).join(' ') || undefined,
    city: a.city ?? a.town ?? a.village ?? a.suburb,
    region: a.state,
    postalCode: a.postcode,
    // Prefer the country name; countryMatches reconciles it with the alpha-2 input.
    country: a.country ?? (a.country_code ? a.country_code.toUpperCase() : undefined),
    latitude: lat,
    longitude: lon,
  }

  return { address, displayName: data.display_name || undefined, raw: data }
}
