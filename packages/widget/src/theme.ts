import type { ProjectBranding } from '@arkyc/types'
import themeCss from 'virtual:arkyc-theme-css'

const LIGHT = {
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
}

const DARK = {
  background: '#0f172a',
  foreground: '#f8fafc',
  muted: '#94a3b8',
  border: '#1e293b',
}

/**
 * Resolves project branding into a concrete theme and renders its CSS. One class
 * owns the whole "theme" concern: defaulted colour/logo/radius values plus the
 * CSS-variable block and stylesheet derived from them.
 */
export class Theme {
  readonly primaryColor: string
  readonly borderRadius: number
  readonly mode: 'light' | 'dark'
  readonly logoUrl: string | null
  /** Project/company display name shown in the header (when branding is shown). */
  readonly name: string | null
  /** Whether to show the project name/logo in the header (white-label off → false). */
  readonly showBranding: boolean
  /** Surface (card) background. */
  readonly background: string
  /** Primary text colour. */
  readonly foreground: string
  /** Muted text colour. */
  readonly muted: string
  /** Subtle border colour. */
  readonly border: string

  constructor(branding?: ProjectBranding | null) {
    this.mode = branding?.theme === 'dark' ? 'dark' : 'light'
    const palette = this.mode === 'dark' ? DARK : LIGHT
    this.primaryColor = branding?.primary_color ?? '#b8860b'
    this.borderRadius = branding?.border_radius ?? 12
    this.logoUrl = branding?.logo_url ?? null
    this.name = branding?.name ?? null
    this.showBranding = branding?.show_branding !== false
    this.background = palette.background
    this.foreground = palette.foreground
    this.muted = palette.muted
    this.border = palette.border
  }

  /**
   * The CSS-variable declaration block for this theme.
   *
   * @returns
   */
  variables(): string {
    return [
      `--arkyc-primary:${this.primaryColor}`,
      `--arkyc-radius:${this.borderRadius}px`,
      `--arkyc-bg:${this.background}`,
      `--arkyc-fg:${this.foreground}`,
      `--arkyc-muted:${this.muted}`,
      `--arkyc-border:${this.border}`,
    ].join(';')
  }

  /**
   * The widget stylesheet, parameterised by this theme's variables.
   *
   * @returns
   */
  stylesheet(): string {
    return themeCss.replace('/* ${this.variables()}; */', `${this.variables()};`).trim()
  }
}
