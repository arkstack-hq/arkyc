import { describe, expect, it } from 'vitest'
import { NetworkDriverFactory, isPrivateAddress, toAlpha2 } from '../src/index'

describe('toAlpha2', () => {
  it('normalizes alpha-2, alpha-3 and MRZ codes', () => {
    expect(toAlpha2('ng')).toBe('NG')
    expect(toAlpha2('GBR')).toBe('GB')
    expect(toAlpha2('D<<')).toBe('DE')
    expect(toAlpha2('UTO')).toBeNull()
    expect(toAlpha2(null)).toBeNull()
  })
})

describe('MockNetworkDriver', () => {
  const driver = NetworkDriverFactory.create({ driver: 'mock' })

  it('flags the documentation ranges and leaves others clean', async () => {
    expect(await driver.lookup('192.0.2.10')).toMatchObject({ vpn: true })
    expect(await driver.lookup('198.51.100.7')).toMatchObject({ tor: true })
    expect(await driver.lookup('203.0.113.5')).toMatchObject({ hosting: true })
    expect(await driver.lookup('8.8.8.8')).toMatchObject({ vpn: false, tor: false, hosting: false, proxy: false })
  })
})

describe('isPrivateAddress', () => {
  it('recognizes private and loopback addresses', () => {
    expect(isPrivateAddress('10.1.2.3')).toBe(true)
    expect(isPrivateAddress('::ffff:192.168.0.4')).toBe(true)
    expect(isPrivateAddress('::1')).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
  })
})

describe('MaxMindNetworkDriver', () => {
  it('requires a database path', () => {
    expect(() => NetworkDriverFactory.create({ driver: 'maxmind' })).toThrow(/database/)
  })
})
