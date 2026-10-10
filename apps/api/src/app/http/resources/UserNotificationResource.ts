import { Resource } from 'resora'

/** An in-app notification for the signed-in user. */
export default class UserNotificationResource extends Resource {
  data() {
    return {
      id: this.id,
      type: this.type ?? null,
      title: this.title,
      description: this.description,
      action_text: this.actionText ?? null,
      action_link: this.actionLink ?? null,
      meta: this.meta ?? null,
      read_at: this.readAt ?? null,
      created_at: this.createdAt,
    }
  }
}
