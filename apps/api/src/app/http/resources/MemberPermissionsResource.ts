import { Resource } from 'resora'

/** A member's resolved permissions: role-derived, direct grants, and their effective union. */
export default class MemberPermissionsResource extends Resource {
  data() {
    return {
      role_id: this.roleId,
      role_permissions: this.rolePermissions,
      direct_permissions: this.directPermissions,
      effective_permissions: this.effectivePermissions,
    }
  }
}
