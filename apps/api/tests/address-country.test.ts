import { describe, expect, it } from 'vitest'

import { aggregate, countryMatches } from '../src/app/services/providers/address/aggregate'

describe('countryMatches', () => {
  it('matches an alpha-2 code against the resolved country name', () => {
    // openrouteservice returns "Nigeria"; the user enters "NG".
    expect(countryMatches('Nigeria', 'NG')).toBe(true)
    // Nominatim/legacy alpha-2 code against an alpha-2 hint.
    expect(countryMatches('NG', 'NG')).toBe(true)
    // Name against name.
    expect(countryMatches('Nigeria', 'Nigeria')).toBe(true)
    // Resolved alpha-2 against a typed name.
    expect(countryMatches('NG', 'Nigeria')).toBe(true)
  })

  it('rejects a genuine country mismatch', () => {
    expect(countryMatches('Ghana', 'NG')).toBe(false)
    expect(countryMatches('Nigeria', 'GH')).toBe(false)
  })

  it('passes through when no hint is given, fails when nothing resolved', () => {
    expect(countryMatches('Nigeria', undefined)).toBe(true)
    expect(countryMatches(undefined, 'NG')).toBe(false)
  })
})

describe('aggregate', () => {
  it('passes only when every method passes and methods are consistent', () => {
    const ok = aggregate([
      { method: 'geocode_lookup', passed: true, confidence: 0.9, resolved: { country: 'Nigeria', city: 'Kaduna' } },
      { method: 'device_location', passed: true, confidence: 0.8, resolved: { country: 'Nigeria', city: 'Kaduna' } },
    ])
    expect(ok.passed).toBe(true)
    expect(ok.consistent).toBe(true)

    const inconsistent = aggregate([
      { method: 'geocode_lookup', passed: true, confidence: 0.9, resolved: { country: 'Nigeria' } },
      { method: 'device_location', passed: true, confidence: 0.8, resolved: { country: 'Ghana' } },
    ])
    expect(inconsistent.consistent).toBe(false)
    expect(inconsistent.passed).toBe(false)
  })
})
