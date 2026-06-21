import type { ProjectBranding } from '@arkyc/types'

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
    this.primaryColor = branding?.primary_color ?? '#4f46e5'
    this.borderRadius = branding?.border_radius ?? 12
    this.logoUrl = branding?.logo_url ?? null
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
    return `
.arkyc-root{${this.variables()};color:var(--arkyc-fg);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-sizing:border-box}
.arkyc-root *{box-sizing:border-box}
.arkyc-card{background:var(--arkyc-bg);border-radius:var(--arkyc-radius);width:100%;max-width:480px;height:100%;max-height:720px;display:flex;flex-direction:column;overflow:hidden}
.arkyc-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--arkyc-border)}
.arkyc-logo{height:24px}
.arkyc-title{font-size:15px;font-weight:600;margin:0}
.arkyc-close{background:none;border:0;color:var(--arkyc-muted);font-size:20px;line-height:1;cursor:pointer}
.arkyc-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:24px;overflow-y:auto}
.arkyc-h{font-size:20px;font-weight:600;margin:0}
.arkyc-p{font-size:14px;color:var(--arkyc-muted);margin:0;max-width:340px}
.arkyc-footer{padding:16px 20px;border-top:1px solid var(--arkyc-border)}
.arkyc-btn{appearance:none;border:0;border-radius:var(--arkyc-radius);background:var(--arkyc-primary);color:#fff;font-size:15px;font-weight:600;padding:12px 18px;width:100%;cursor:pointer}
.arkyc-btn[disabled]{opacity:.5;cursor:not-allowed}
.arkyc-btn-ghost{background:transparent;color:var(--arkyc-primary);border:1px solid var(--arkyc-border)}
.arkyc-choices{display:flex;flex-direction:column;gap:8px;width:100%;max-width:340px}
.arkyc-preview{width:100%;max-width:360px;border-radius:var(--arkyc-radius);background:#000;aspect-ratio:3/2;object-fit:cover}
.arkyc-preview.selfie{aspect-ratio:1/1;max-width:280px;border-radius:50%}
.arkyc-spinner{width:42px;height:42px;border-radius:50%;border:4px solid var(--arkyc-border);border-top-color:var(--arkyc-primary);animation:arkyc-spin 1s linear infinite}
@keyframes arkyc-spin{to{transform:rotate(360deg)}}
.arkyc-badge{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff}
.arkyc-badge.ok{background:#16a34a}
.arkyc-badge.warn{background:#d97706}
.arkyc-badge.err{background:#dc2626}
.arkyc-hidden{display:none}
`.trim()
  }
}
