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
    this.primaryColor = branding?.primary_color ?? '#4f46e5'
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
    return `
.arkyc-root{${this.variables()};color:var(--arkyc-fg);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-sizing:border-box}
.arkyc-root *{box-sizing:border-box}
.arkyc-card{background:var(--arkyc-bg);border-radius:var(--arkyc-radius);width:100%;max-width:480px;height:100%;max-height:720px;display:flex;flex-direction:column;overflow:hidden}
.arkyc-root.arkyc-fullscreen .arkyc-card{max-width:none;max-height:none;height:100%;border-radius:0}
/* On a wider (desktop) viewport, "fullscreen" is a large centred dialog rather
   than edge-to-edge — except in handoff mode, where the QR stays prominent. */
@media (min-width:700px){
  .arkyc-root.arkyc-fullscreen .arkyc-card{max-width:560px;width:100%;height:auto;min-height:min(620px,92vh);max-height:92vh;border-radius:var(--arkyc-radius)}
  .arkyc-root.arkyc-fullscreen.arkyc-handoff .arkyc-card{max-width:none;height:100%;min-height:0;max-height:none;border-radius:0}
}
.arkyc-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--arkyc-border)}
.arkyc-logo{height:24px;width:auto}
.arkyc-title{font-size:15px;font-weight:600;margin:0}
.arkyc-brand{display:flex;align-items:center;gap:10px;min-width:0}
.arkyc-brand-name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
.arkyc-preview.selfie{aspect-ratio:1/1;max-width:280px;border-radius:50%;transform:scaleX(-1)}
.arkyc-spinner{width:42px;height:42px;border-radius:50%;border:4px solid var(--arkyc-border);border-top-color:var(--arkyc-primary);animation:arkyc-spin 1s linear infinite}
.arkyc-spinner.sm{width:18px;height:18px;border-width:3px}
@keyframes arkyc-spin{to{transform:rotate(360deg)}}
.arkyc-qr{width:200px;height:200px;padding:12px;margin:4px auto;background:#fff;border-radius:var(--arkyc-radius);border:1px solid var(--arkyc-border)}
.arkyc-qr svg{display:block;width:100%;height:100%}
.arkyc-handoff-wait{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--arkyc-muted);font-size:14px;margin-top:6px}
.arkyc-badge{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff}
.arkyc-badge.ok{background:#16a34a}
.arkyc-badge.warn{background:#d97706}
.arkyc-badge.err{background:#dc2626}
/* --- Animated capture overlays --- */
.arkyc-stage{position:relative;width:100%;max-width:280px;margin:0 auto}
.arkyc-stage .arkyc-preview{display:block;width:100%;max-width:100%}
.arkyc-ring{position:absolute;inset:0;pointer-events:none}
.arkyc-ring svg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.arkyc-ring-track{fill:none;stroke:rgba(125,130,150,.3);stroke-width:3}
.arkyc-ring-arc{fill:none;stroke:var(--arkyc-primary);stroke-width:4;stroke-linecap:round;transition:stroke-dashoffset .15s linear,stroke .25s}
.arkyc-stage[data-state=wait] .arkyc-ring-track{animation:arkyc-pulse 1.5s ease-in-out infinite}
.arkyc-stage[data-state=good] .arkyc-ring-arc,.arkyc-stage[data-state=done] .arkyc-ring-arc,.arkyc-stage[data-state=done] .arkyc-ring-track{stroke:#16a34a}
.arkyc-cue{position:absolute;left:0;right:0;bottom:7%;display:flex;justify-content:center;align-items:center;pointer-events:none;opacity:0;transition:opacity .25s}
.arkyc-cue.show{opacity:1}
.arkyc-cue svg{width:36px;height:36px;color:#fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,.55))}
.arkyc-cue-turn_right svg{animation:arkyc-nudge-r 1.1s ease-in-out infinite}
.arkyc-cue-turn_left svg{animation:arkyc-nudge-l 1.1s ease-in-out infinite}
.arkyc-cue-nod svg{animation:arkyc-nudge-d 1.1s ease-in-out infinite}
.arkyc-cue-move_closer svg{animation:arkyc-zoom 1.2s ease-in-out infinite}
.arkyc-cue-blink svg,.arkyc-cue-smile svg{animation:arkyc-soft 1.3s ease-in-out infinite}
.arkyc-check{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.5);transition:opacity .25s,transform .25s;pointer-events:none}
.arkyc-check svg{width:56px;height:56px;color:#16a34a;background:rgba(255,255,255,.92);border-radius:50%;padding:10px;box-sizing:border-box}
.arkyc-stage[data-state=done] .arkyc-check{opacity:1;transform:scale(1)}
.arkyc-stage[data-state=done] .arkyc-cue{opacity:0}
.arkyc-dots{display:flex;gap:8px;justify-content:center;margin:0 0 14px}
.arkyc-dot{width:8px;height:8px;border-radius:50%;background:var(--arkyc-border);transition:background .3s,transform .3s}
.arkyc-dot.active{background:var(--arkyc-primary);transform:scale(1.4);animation:arkyc-pulse 1.2s ease-in-out infinite}
.arkyc-dot.done{background:#16a34a}
.arkyc-doc{position:relative;width:100%;max-width:360px;margin:0 auto}
.arkyc-doc .arkyc-preview{display:block;width:100%;max-width:100%}
.arkyc-doc-frame{position:absolute;inset:5%;pointer-events:none;transition:left .18s ease,top .18s ease,width .18s ease,height .18s ease}
.arkyc-corner{position:absolute;width:24px;height:24px;border:3px solid rgba(255,255,255,.9);transition:border-color .3s}
.arkyc-corner.tl{top:0;left:0;border-right:none;border-bottom:none;border-top-left-radius:6px}
.arkyc-corner.tr{top:0;right:0;border-left:none;border-bottom:none;border-top-right-radius:6px}
.arkyc-corner.bl{bottom:0;left:0;border-right:none;border-top:none;border-bottom-left-radius:6px}
.arkyc-corner.br{bottom:0;right:0;border-left:none;border-top:none;border-bottom-right-radius:6px}
.arkyc-scan{position:absolute;left:5%;right:5%;top:8%;height:2px;background:linear-gradient(90deg,transparent,var(--arkyc-primary),transparent);box-shadow:0 0 8px var(--arkyc-primary);animation:arkyc-scan 2.4s ease-in-out infinite}
.arkyc-doc[data-q=good] .arkyc-corner{border-color:#16a34a}
.arkyc-doc[data-q=good] .arkyc-scan{background:linear-gradient(90deg,transparent,#16a34a,transparent);box-shadow:0 0 8px #16a34a}
.arkyc-doc[data-q=bad] .arkyc-corner{border-color:#f59e0b}
@keyframes arkyc-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes arkyc-nudge-r{0%,100%{transform:translateX(-7px)}50%{transform:translateX(7px)}}
@keyframes arkyc-nudge-l{0%,100%{transform:translateX(7px)}50%{transform:translateX(-7px)}}
@keyframes arkyc-nudge-d{0%,100%{transform:translateY(-6px)}50%{transform:translateY(6px)}}
@keyframes arkyc-zoom{0%,100%{transform:scale(.8)}50%{transform:scale(1.15)}}
@keyframes arkyc-soft{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes arkyc-scan{0%,100%{top:8%}50%{top:88%}}
@media (prefers-reduced-motion:reduce){.arkyc-ring-track,.arkyc-cue svg,.arkyc-scan,.arkyc-dot,.arkyc-spinner{animation:none!important}.arkyc-ring-arc{transition:none!important}}
.arkyc-hidden{display:none}
`.trim()
  }
}
