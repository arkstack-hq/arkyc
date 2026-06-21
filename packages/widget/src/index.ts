/**
 * @arkyc/widget
 *
 * Framework-agnostic, embeddable identity-verification widget. Drives a single
 * session through the Arkyc Client/Widget API with a short-lived client token.
 *
 * ```ts
 * import { ArkycWidget } from '@arkyc/widget'
 *
 * // Overlay modal:
 * ArkycWidget.open({ token, onComplete: (r) => console.log(r.status) })
 *
 * // Inline (mounted into a container):
 * ArkycWidget.mount({ token, container: '#verify' })
 *
 * // Hosted page (reads ?token= and posts results to the parent window):
 * ArkycWidget.hosted()
 * ```
 */
import type { ProjectBranding, WidgetResult } from '@arkyc/types'
import { WidgetController } from './controller'
import type { ProviderSignalHints } from './client'

export const PACKAGE_NAME = '@arkyc/widget'
export const VERSION = '0.1.0'

/** Common options shared by every launch mode. */
export interface BaseWidgetOptions {
  /** Short-lived client token minted by the integrator's backend. */
  token: string
  /** API origin (defaults to the page's own origin). */
  baseUrl?: string
  /** Branding (colors, logo, radius, theme). Usually sourced from project config. */
  branding?: ProjectBranding | null
  /** Mock-driver signal hints; enables a "Skip" affordance on capture screens. */
  signals?: ProviderSignalHints
  onComplete?: (result: WidgetResult) => void
  onError?: (error: Error) => void
  onClose?: () => void

  // Injectables (testing / non-browser hosts).
  fetch?: typeof fetch
  doc?: Document
  win?: Window
  nav?: Navigator
}

/** Options for {@link ArkycWidget.mount} (inline mode). */
export interface MountWidgetOptions extends BaseWidgetOptions {
  /** Element (or selector) to mount the widget into. */
  container: string | HTMLElement
}

/** A handle to an open/mounted widget. */
export interface WidgetHandle {
  /** Close the widget and release the camera (fires `onClose`). */
  close: () => void
}

function resolveContainer(container: string | HTMLElement, doc: Document): HTMLElement {
  const el = typeof container === 'string' ? doc.querySelector<HTMLElement>(container) : container
  if (!el) throw new Error(`ArkycWidget.mount: container "${String(container)}" not found.`)
  return el
}

function buildController(options: BaseWidgetOptions, onSettle: () => void): WidgetController {
  if (!options.token) throw new Error('ArkycWidget requires a client `token`.')
  return new WidgetController({
    token: options.token,
    baseUrl: options.baseUrl,
    branding: options.branding,
    signals: options.signals,
    onComplete: options.onComplete,
    onError: options.onError,
    onClose: options.onClose,
    onSettle,
    fetch: options.fetch,
    doc: options.doc,
    win: options.win,
    nav: options.nav,
  })
}

export const ArkycWidget = {
  /** Open the widget as a full-screen overlay modal. Returns a close handle. */
  open(options: BaseWidgetOptions): WidgetHandle {
    const doc = options.doc ?? globalThis.document
    const overlay = doc.createElement('div')
    overlay.setAttribute('data-arkyc-widget', '')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;'

    const controller = buildController(options, () => overlay.remove())
    overlay.appendChild(controller.element)
    ;(doc.body ?? doc.documentElement).appendChild(overlay)
    controller.start()
    return { close: () => controller.close() }
  },

  /** Mount the widget inline into a container element. Returns a close handle. */
  mount(options: MountWidgetOptions): WidgetHandle {
    const doc = options.doc ?? globalThis.document
    const container = resolveContainer(options.container, doc)
    const controller = buildController(options, () => controller.element.remove())
    container.appendChild(controller.element)
    controller.start()
    return { close: () => controller.close() }
  },

  /**
   * Bootstrap the widget on its hosted page: read the client `token` (and
   * optional `baseUrl`) from the query string and run in overlay mode, posting
   * `arkyc:*` results to the parent (iframe) window.
   */
  hosted(options: Partial<BaseWidgetOptions> = {}): WidgetHandle {
    const win = options.win ?? globalThis.window
    const params = new URLSearchParams(win.location.search)
    const token = options.token ?? params.get('token') ?? ''
    const baseUrl = options.baseUrl ?? params.get('baseUrl') ?? undefined
    return ArkycWidget.open({ ...options, token, baseUrl })
  },
}

export type { WidgetController } from './controller'
export { ArkycClient, WidgetApiError } from './client'
export type { ClientSession, ProviderSignalHints, ArkycClientOptions } from './client'
export { Theme } from './theme'
export { Camera } from './capture'
export type { Facing } from './capture'
export { Flow } from './flow'
export type { FlowContext } from './flow'
export type { WidgetResult } from '@arkyc/types'
