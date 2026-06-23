import type { WidgetController } from './controller'
import type { WidgetEventListener, WidgetHandle } from './types'

export class WidgetHandler implements WidgetHandle {
  constructor(private controller: WidgetController) {}

  /**
   * Close the widget and release the camera (fires `onClose`).
   */
  close(): void {
    return this.controller.close()
  }
  /**
   * Subscribe to a named widget event (e.g. `session.transition`, `complete`).
   * Returns an unsubscribe function. Registering a listener activates the event
   * stream (events are only delivered while at least one listener is active).
   *
   * @param event
   * @param listener
   */
  on(event: string, listener: WidgetEventListener): () => void {
    return this.controller.on(event, listener)
  }
}
