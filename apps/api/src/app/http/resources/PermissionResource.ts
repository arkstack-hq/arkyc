import { Resource } from 'resora'

export default class PermissionResource extends Resource {
  data() {
    return {
      id: this.id,
      name: this.name,
      description: this.description ?? null,
      group: this.group,
    }
  }
}
