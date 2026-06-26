import type { AddressMethod, AddressResultData, PostalAddress } from '@arkyc/types'

/** The address evidence + context handed to an address verifier. */
export interface AddressRequest {
  /** Methods to run, from the workflow's address config. */
  methods: AddressMethod[]
  /** The address the user typed/claimed, when provided. */
  claimed?: PostalAddress | null
  /** Proof-of-address document bytes (the `poa_document` method). */
  poaImage?: Uint8Array | null
  /** Device coordinates (the `device_location` method). */
  coords?: { latitude: number; longitude: number } | null
  /** Expected ISO country (alpha-2) to constrain geocoding, e.g. `NG`. */
  countryHint?: string | null
  /**
   * Deterministic steering for the `mock` verifier / tests. Ignored by the live
   * verifier.
   */
  hints?: { passed?: boolean; score?: number }
}

/** A pluggable address verifier — runs the requested methods and aggregates them. */
export interface AddressVerifier {
  readonly name: string
  verify(request: AddressRequest): Promise<AddressResultData>
}

/** Identifier for a registered address verifier. */
export type AddressDriverName = 'mock' | 'live'

/** Configuration selecting + parameterising the address verifier. */
export interface AddressConfig {
  driver: AddressDriverName
  /** openrouteservice API key (forward geocoding, the `geocode_lookup` method). */
  orsApiKey?: string
  /** openrouteservice geocode-search base URL. */
  orsUrl?: string
  /** Nominatim base URL (reverse geocoding, the `device_location` method). */
  nominatimUrl?: string
  /** User-Agent for Nominatim — its usage policy requires an identifying one. */
  userAgent?: string
}

/** Format a {@link PostalAddress} as a single free-text line for geocoding. */
export function formatAddress(address?: PostalAddress | null): string {
  if (!address) return ''

  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.country]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ')
}
