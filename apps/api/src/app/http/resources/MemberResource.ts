import { Resource } from 'resora'

type Related = { getAttribute (key: string): unknown } | null | undefined

/** A tenant member; eager-load `user` and `role` relations for nested data. */
export default class MemberResource extends Resource {
    data () {
        const user = this.resource.getAttribute('user') as Related
        const role = this.resource.getAttribute('role') as Related

        return {
            id: this.id,
            user_id: this.userId,
            role_id: this.roleId,
            status: this.status,
            joined_at: this.joinedAt ?? null,
            user: user
                ? { id: user.getAttribute('id'), name: user.getAttribute('name'), email: user.getAttribute('email') }
                : null,
            role: role
                ? { id: role.getAttribute('id'), name: role.getAttribute('name'), slug: role.getAttribute('slug') }
                : null,
        }
    }
}
