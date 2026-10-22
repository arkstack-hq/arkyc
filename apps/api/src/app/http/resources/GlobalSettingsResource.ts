import { Resource } from 'resora'

/** Platform-wide settings, served on the `/admin` surface. */
export default class GlobalSettingsResource extends Resource {
  data() {
    return {
      platform: this.platform,
      capture: this.capture,
      compliance: this.compliance,
      assets: this.assets,
    }
  }
}
