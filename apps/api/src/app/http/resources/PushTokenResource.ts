import { Resource } from 'resora'

/** A device registered for push notifications. The token itself is not echoed. */
export default class PushTokenResource extends Resource {
  data() {
    return {
      id: this.id,
      platform: this.platform,
      device_name: this.deviceName ?? null,
      last_registered_at: this.lastRegisteredAt,
    }
  }
}
