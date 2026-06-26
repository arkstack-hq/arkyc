import type { AddressMethodResult, AddressResultData, PostalAddress } from '@arkyc/types'

const clamp01 = (n: number): number => (Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)))
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Loose normalisation for comparing place names (lowercase, alphanumeric only). */
export const norm = (s?: string): string =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** English display name for an ISO 3166-1 alpha-2 code (e.g. `NG` → `Nigeria`), else the input. */
function countryName(value: string): string {
  if (!/^[a-z]{2}$/i.test(value)) return value
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(value.toUpperCase()) ?? value
  } catch {
    return value
  }
}

/**
 * Whether a resolved country matches the expected one. Geocoders return the
 * country NAME ("Nigeria") or a 3-letter code ("NGA"), while users enter an
 * alpha-2 code ("NG"); compare loosely by mapping any alpha-2 code to its name
 * so `NG` and `Nigeria` match.
 */
export function countryMatches(resolved: string | undefined, hint: string | undefined): boolean {
  if (!hint) return true
  if (!resolved) return false
  const r = norm(resolved)
  const h = norm(hint)

  return r === h || r === norm(countryName(hint)) || norm(countryName(resolved)) === h
}

/**
 * Whether the addresses resolved by two or more methods agree. They must share a
 * country; if at least two carry a city, those must match too. Fewer than two
 * resolved addresses can't disagree, so they're trivially consistent.
 */
export function addressesConsistent(results: AddressMethodResult[]): boolean {
  const resolved = results.map((r) => r.resolved).filter((a): a is PostalAddress => !!a)
  if (resolved.length < 2) return true

  const countries = new Set(resolved.map((r) => norm(r.country)).filter(Boolean))
  if (countries.size > 1) return false

  const cities = resolved.map((r) => norm(r.city)).filter(Boolean)
  if (cities.length >= 2 && new Set(cities).size > 1) return false

  return true
}

/**
 * Fold per-method results into the aggregate the decision engine reads. Overall
 * `passed` requires every method to pass AND the methods to be mutually
 * consistent; `score` is the mean method confidence.
 */
export function aggregate(results: AddressMethodResult[]): AddressResultData {
  const consistent = addressesConsistent(results)
  const allPassed = results.length > 0 && results.every((r) => r.passed)

  return {
    passed: allPassed && consistent,
    score: clamp01(mean(results.map((r) => r.confidence))),
    methods: results,
    consistent,
    raw: { methods: results.map((r) => r.method), consistent },
  }
}
