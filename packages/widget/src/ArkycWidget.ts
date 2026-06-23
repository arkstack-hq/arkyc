import type { BaseWidgetOptions, MountWidgetOptions, WidgetHandle } from './types'
import { buildController, resolveContainer } from './controller'

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
export class ArkycWidget {
  /**
   * Open the widget as a full-screen overlay modal. Returns a close handle.
   *
   * @param options
   * @returns
   */
  static open(options: BaseWidgetOptions): WidgetHandle {
    const doc = options.doc ?? globalThis.document
    const overlay = doc.createElement('div')

    overlay.setAttribute('data-arkyc-widget', '')
    // Fullscreen: edge-to-edge with no backdrop gap. Otherwise a centred modal
    // over a dimmed backdrop.
    // Both modes use a dimmed, centred backdrop. Fullscreen fills the viewport on
    // mobile but renders as a large centred dialog on desktop (see the card CSS);
    // the dimmed backdrop is what's visible around that dialog.
    overlay.style.cssText = options.fullscreen
      ? 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:0;'
      : 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;'

    const controller = buildController(options, () => overlay.remove())
    if (options.fullscreen) controller.element.classList.add('arkyc-fullscreen')
    overlay.appendChild(controller.element)
    ;(doc.body ?? doc.documentElement).appendChild(overlay)
    controller.start()

    return {
      close: () => controller.close(),
    }
  }

  /**
   * Mount the widget inline into a container element. Returns a close handle.
   *
   * @param options
   * @returns
   */
  static mount(options: MountWidgetOptions): WidgetHandle {
    const doc = options.doc ?? globalThis.document
    const container = resolveContainer(options.container, doc)
    const controller = buildController(options, () => controller.element.remove())

    container.appendChild(controller.element)
    controller.start()

    return {
      close: () => controller.close(),
    }
  }

  /**
   * Bootstrap the widget on its hosted page: read the client `token` (and
   * optional `baseUrl`) from the query string and run in overlay mode, posting
   * `arkyc:*` results to the parent (iframe) window.
   *
   * @param options
   * @returns
   */
  static hosted(options: Partial<BaseWidgetOptions> = {}): WidgetHandle {
    const win = options.win ?? globalThis.window
    const params = new URLSearchParams(win.location.search)
    const token = options.token ?? params.get('token') ?? ''
    const baseUrl = options.baseUrl ?? params.get('baseUrl') ?? undefined

    return ArkycWidget.open({ ...options, token, baseUrl })
  }
}
