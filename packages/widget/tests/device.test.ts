import { describe, expect, it } from 'vitest'
import { isDesktopDevice } from '../src/device'

const nav = (over: Partial<Navigator>): Navigator =>
  ({ userAgent: '', platform: '', maxTouchPoints: 0, ...over }) as Navigator

describe('isDesktopDevice', () => {
  it('treats a desktop browser as desktop', () => {
    expect(isDesktopDevice(nav({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' }))).toBe(
      true,
    )
    expect(isDesktopDevice(nav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel' }))).toBe(
      true,
    )
  })

  it('treats phones and tablets as non-desktop', () => {
    expect(isDesktopDevice(nav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', platform: 'iPhone' }))).toBe(
      false,
    )
    expect(
      isDesktopDevice(nav({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel)', platform: 'Linux armv8l' })),
    ).toBe(false)
  })

  it('treats an unknown/empty user agent as non-desktop', () => {
    expect(isDesktopDevice(nav({}))).toBe(false)
  })

  it('detects iPadOS masquerading as desktop Safari via touch points', () => {
    expect(
      isDesktopDevice(
        nav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 }),
      ),
    ).toBe(false)
  })
})
