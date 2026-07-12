import type { WidgetController } from './controller'
import type { WidgetEventListener, WidgetEventName, WidgetHandle } from './types'

export class WidgetHandler implements WidgetHandle {
  constructor(private controller: WidgetController) {}

  /**
   * Close the widget and release the camera (fires `onClose`).
   */
  close(): void {
    return this.controller.close()
  }
  /**
   * Subscribe to a named widget event (`session.transition`, `complete`,
   * `error`, `close`). The `listener`'s `data` is typed from the `event` name.
   * Returns an unsubscribe function. Registering a listener activates the event
   * stream (events are only delivered while at least one listener is active).
   *
   * @param event
   * @param listener
   */
  on<K extends WidgetEventName>(event: K, listener: WidgetEventListener<K>): () => void {
    return this.controller.on(event, listener)
  }
}
