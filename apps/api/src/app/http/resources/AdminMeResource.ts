import { Resource } from 'resora'

/** The caller's platform-admin standing, used by the dashboard to gate `/admin`. */
export default class AdminMeResource extends Resource {
  data() {
    return {
      is_admin: this.isAdmin,
      permissions: this.permissions,
    }
  }
}
