import type { OpenWidgetOptions, WidgetEventListener, WidgetHandle, WidgetResult } from './types'

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
 *
 * Self-hosting the widget page? Point the launcher at your own origin without
 * editing call sites, in priority order:
 *
 * 1. per call — `ArkycWidget.open({ widgetUrl, ... })`
 * 2. once, in code — `ArkycWidget.configure({ widgetUrl })` at app bootstrap
 * 3. no code — set a global before the SDK loads (works for bundlers and the
 *    `<script>` build alike), e.g. in your HTML:
 *    `<script>globalThis.ARKYC_WIDGET_URL = 'https://verify.example.com'</script>`
 *    or wired from your build env: `globalThis.ARKYC_WIDGET_URL = import.meta.env.VITE_ARKYC_WIDGET_URL`
 */
export class ArkycWidget {
  /** Built-in fallback when no override is configured. */
  private static DEFAULT_WIDGET_URL = 'https://arkyc.toneflix.net/verify'

  /** Programmatic default set once via {@link ArkycWidget.configure}. */
  private static configuredWidgetUrl: string | undefined

  /**
   * Set launcher-wide defaults once (e.g. at app bootstrap) so individual
   * `open()` calls don't need to repeat them. Currently the hosted widget URL —
   * for self-hosted widget pages.
   *
   * @param options
   */
  static configure(options: { widgetUrl?: string }): void {
    if (options.widgetUrl) ArkycWidget.configuredWidgetUrl = options.widgetUrl
  }

  /**
   * Resolve the hosted widget URL: explicit per-call value, then a
   * {@link ArkycWidget.configure | configured} default, then the runtime global
   * `globalThis.ARKYC_WIDGET_URL` (settable from HTML or a build define), then
   * the built-in default.
   *
   * @param explicit
   * @returns
   */
  private static resolveWidgetUrl(explicit?: string): string {
    const fromGlobal = (globalThis as { ARKYC_WIDGET_URL?: string }).ARKYC_WIDGET_URL

    return explicit ?? ArkycWidget.configuredWidgetUrl ?? fromGlobal ?? ArkycWidget.DEFAULT_WIDGET_URL
  }

  /**
   * Open the verification widget for a client token. Returns a close handle.
   *
   * @param options
   * @returns
   */
  static open(options: OpenWidgetOptions): WidgetHandle {
    if (!options.token) throw new Error('ArkycWidget.open requires a client `token`.')

    const doc = options.doc ?? globalThis.document
    const win = options.win ?? globalThis.window
    if (!doc || !win) throw new Error('ArkycWidget.open must run in a browser environment.')

    const widgetUrl = ArkycWidget.resolveWidgetUrl(options.widgetUrl).replace(/\/$/, '')
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

    // Named event listeners registered via the returned handle's `on`.
    const listeners = new Map<string, Set<WidgetEventListener>>()
    const emit = (name: string, payload?: unknown): void => {
      options.onEvent?.({ name, data: payload })
      listeners.get(name)?.forEach((listener) => listener(payload))
    }

    const close = (): void => {
      win.removeEventListener('message', onMessage)
      overlay.remove()
      options.onClose?.()
    }

    const onMessage = (event: MessageEvent): void => {
      const data = event.data as {
        type?: string
        payload?: WidgetResult
        error?: unknown
        name?: string
        data?: unknown
      } | null
      if (!data || typeof data.type !== 'string' || !data.type.startsWith('arkyc:')) return

      if (data.type === 'arkyc:event') {
        // The widget's event firehose, forwarded across the iframe.
        if (typeof data.name === 'string') emit(data.name, data.data)
      } else if (data.type === 'arkyc:complete') {
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

    return {
      close,
      on: (event, listener) => {
        const set = listeners.get(event) ?? new Set<WidgetEventListener>()
        set.add(listener)
        listeners.set(event, set)

        return () => set.delete(listener)
      },
    }
  }
}
