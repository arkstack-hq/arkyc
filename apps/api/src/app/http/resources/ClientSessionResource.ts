import { Resource } from 'resora'

/** The minimal session view exposed to the widget (Client API). */
export default class ClientSessionResource extends Resource {
  data() {
    return {
      id: this.id,
      status: this.status,
      expires_at: this.expiresAt,
    }
  }
}
