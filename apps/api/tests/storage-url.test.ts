import { afterEach, describe, expect, it, vi } from 'vitest'
import { Storage } from '@arkstack/filesystem'
import { resolveBranding, resolveObjectUrl } from 'src/support/storage'

type Disk = ReturnType<typeof Storage.disk>

const fakeDisk = (driver: string, overrides: Record<string, unknown> = {}) =>
  ({
    getDriverName: () => driver,
    getUrl: vi.fn(async (key: string) => `https://plain.test/${key}`),
    getSignedUrl: vi.fn(async (key: string) => `https://signed.test/${key}?X-Amz-Signature=abc`),
    ...overrides,
  }) as unknown as Disk

describe('resolveObjectUrl', () => {
  afterEach(() => vi.restoreAllMocks())

  it('signs objects on a remote disk with the asset TTL', async () => {
    const disk = fakeDisk('s3')
    vi.spyOn(Storage, 'disk').mockReturnValue(disk)

    expect(await resolveObjectUrl('a/logo')).toBe('https://signed.test/a/logo?X-Amz-Signature=abc')
    expect(disk.getSignedUrl).toHaveBeenCalledWith('a/logo', { expiresIn: expect.stringMatching(/^\d+s$/) })
  })

  it('serves the plain URL on the local disk', async () => {
    const disk = fakeDisk('local')
    vi.spyOn(Storage, 'disk').mockReturnValue(disk)

    expect(await resolveObjectUrl('a/logo')).toBe('https://plain.test/a/logo')
    expect(disk.getSignedUrl).not.toHaveBeenCalled()
  })

  it('falls back to the plain URL when signing is unsupported', async () => {
    vi.spyOn(Storage, 'disk').mockReturnValue(
      fakeDisk('custom', { getSignedUrl: vi.fn().mockRejectedValue(new Error('E_URL_GENERATION_UNSUPPORTED')) }),
    )

    expect(await resolveObjectUrl('a/logo')).toBe('https://plain.test/a/logo')
  })
})

describe('resolveBranding', () => {
  afterEach(() => vi.restoreAllMocks())

  it('replaces logo_key with a resolved logo_url', async () => {
    vi.spyOn(Storage, 'disk').mockReturnValue(fakeDisk('s3'))

    expect(await resolveBranding({ name: 'Co', logo_key: 'a/logo', logo_url: 'stale' })).toEqual({
      name: 'Co',
      logo_url: 'https://signed.test/a/logo?X-Amz-Signature=abc',
    })
  })

  it('passes an external logo_url through untouched', async () => {
    expect(await resolveBranding({ logo_url: 'https://cdn.test/logo.svg' })).toEqual({
      logo_url: 'https://cdn.test/logo.svg',
    })
    expect(await resolveBranding(null)).toEqual({})
  })
})
