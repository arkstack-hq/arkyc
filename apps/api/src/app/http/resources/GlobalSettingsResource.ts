import { Resource } from 'resora'

/** Platform-wide settings, served on the `/admin` surface. */
export default class GlobalSettingsResource extends Resource {
  data() {
    return {
      platform: this.platform,
      realtime: this.realtime,
      capture: this.capture,
    }
  }
}
