import { Resource } from 'resora'

/** A user's two-factor status, safe for client consumption. */
export default class TwoFactorStatusResource extends Resource {
  data() {
    return {
      enabled: this.enabled,
      method: this.method,
      recovery_codes_remaining: this.recovery_codes_remaining,
      enabled_at: this.enabled_at,
    }
  }
}
