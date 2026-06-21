import { Resource } from 'resora'

export default class InvitationResource extends Resource {
  data() {
    return {
      id: this.id,
      email: this.email,
      role_id: this.roleId,
      expires_at: this.expiresAt,
      accepted_at: this.acceptedAt ?? null,
      created_at: this.createdAt,
    }
  }
}
