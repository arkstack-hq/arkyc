import { ArkycWidget } from '@arkyc/widget'

/**
 * Hosted continuation page for cross-device handoff. The QR shown on the first
 * device encodes this URL with the session `?token=` and `?baseUrl=` appended;
 * `ArkycWidget.hosted()` reads them and resumes the same session full-screen.
 */
ArkycWidget.hosted({ fullscreen: true })
