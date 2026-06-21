/**
 * @arkyc/sdk/browser
 *
 * Browser launcher for the Arkyc verification widget. Opens the hosted widget
 * in an overlay iframe and relays completion via `postMessage`.
 *
 * ```ts
 * import { ArkycWidget } from '@arkyc/sdk/browser'
 * ArkycWidget.open({ token: clientToken, onComplete: (r) => console.log(r.status) })
 * ```
 */

const DEFAULT_WIDGET_URL = 'https://verify.arkyc.dev'

/** Payload delivered when the widget flow completes. */
export interface WidgetResult {
  status: string
  [key: string]: unknown
}

/** Options for {@link ArkycWidget.open}. */
export interface OpenWidgetOptions {
  /** The session's client token (from `arkyc.sessions.create`). */
  token: string
  /** Hosted widget origin (default `https://verify.arkyc.dev`). */
  widgetUrl?: string
  onComplete?: (result: WidgetResult) => void
  onError?: (error: unknown) => void
  onClose?: () => void
  /** Injectable for testing; defaults to the global `document`. */
  doc?: Document
  /** Injectable for testing; defaults to the global `window`. */
  win?: Window
}

/** A handle to the open widget. */
export interface WidgetHandle {
  close: () => void
}

export const ArkycWidget = {
  /**
   * Open the verification widget for a client token. Returns a close handle.
   *
   * @param options
   * @returns
   */
  open(options: OpenWidgetOptions): WidgetHandle {
    if (!options.token) throw new Error('ArkycWidget.open requires a client `token`.')

    const doc = options.doc ?? globalThis.document
    const win = options.win ?? globalThis.window
    if (!doc || !win) throw new Error('ArkycWidget.open must run in a browser environment.')

    const widgetUrl = (options.widgetUrl ?? DEFAULT_WIDGET_URL).replace(/\/$/, '')
    const src = `${widgetUrl}?token=${encodeURIComponent(options.token)}`

    const overlay = doc.createElement('div')
    overlay.setAttribute('data-arkyc-widget', '')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;'

    const iframe = doc.createElement('iframe')
    iframe.src = src
    iframe.allow = 'camera; microphone'
    iframe.style.cssText =
      'width:100%;max-width:480px;height:100%;max-height:720px;border:0;border-radius:12px;background:#fff;'
    overlay.appendChild(iframe)

    const close = (): void => {
      win.removeEventListener('message', onMessage)
      overlay.remove()
      options.onClose?.()
    }

    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string; payload?: WidgetResult; error?: unknown } | null
      if (!data || typeof data.type !== 'string' || !data.type.startsWith('arkyc:')) return

      if (data.type === 'arkyc:complete') {
        options.onComplete?.(data.payload ?? { status: 'completed' })
        close()
      } else if (data.type === 'arkyc:error') {
        options.onError?.(data.error)
        close()
      } else if (data.type === 'arkyc:close') {
        close()
      }
    }

    win.addEventListener('message', onMessage)
    ;(doc.body ?? doc.documentElement).appendChild(overlay)

    return { close }
  },
}
