import { Resource } from 'resora'

type Related = { getAttribute(key: string): unknown } | null | undefined

/** A project member; eager-load `user` and `role` relations for nested data. */
export default class ProjectMemberResource extends Resource {
  data() {
    const user = this.resource.getAttribute('user') as Related
    const role = this.resource.getAttribute('role') as Related

    return {
      id: this.id,
      project_id: this.projectId,
      user_id: this.userId,
      role_id: this.roleId,
      status: this.status,
      created_at: this.createdAt,
      user: user
        ? {
            id: user.getAttribute('id'),
            name: user.getAttribute('name'),
            email: user.getAttribute('email'),
          }
        : null,
      role: role
        ? {
            id: role.getAttribute('id'),
            name: role.getAttribute('name'),
            slug: role.getAttribute('slug'),
          }
        : null,
    }
  }
}
