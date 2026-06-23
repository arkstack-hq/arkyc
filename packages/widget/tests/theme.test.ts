import { describe, expect, it } from 'vitest'
import { Theme } from '../src/theme'

describe('Theme', () => {
  it('applies sensible light-mode defaults', () => {
    const theme = new Theme()
    expect(theme.mode).toBe('light')
    expect(theme.primaryColor).toBe('#b8860b')
    expect(theme.borderRadius).toBe(12)
    expect(theme.logoUrl).toBeNull()
    expect(theme.background).toBe('#ffffff')
  })

  it('honours project branding overrides and dark mode', () => {
    const theme = new Theme({
      primary_color: '#ff0000',
      border_radius: 4,
      theme: 'dark',
      logo_url: 'https://cdn.test/logo.svg',
    })
    expect(theme.primaryColor).toBe('#ff0000')
    expect(theme.borderRadius).toBe(4)
    expect(theme.mode).toBe('dark')
    expect(theme.logoUrl).toBe('https://cdn.test/logo.svg')
    expect(theme.background).toBe('#0f172a')
  })

  it('emits CSS variables and a stylesheet from the theme', () => {
    const theme = new Theme({ primary_color: '#123456', border_radius: 8 })
    const vars = theme.variables()
    expect(vars).toContain('--arkyc-primary:#123456')
    expect(vars).toContain('--arkyc-radius:8px')

    const css = theme.stylesheet()
    expect(css).toContain('.arkyc-root')
    expect(css).toContain('--arkyc-primary:#123456')
    expect(css).toContain('@keyframes arkyc-spin')
  })
})
