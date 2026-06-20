import type { PermissionKey } from '@arkyc/types'
import { toArray } from 'src/support/collection'
import { Permission } from '@app/models/Permission'
import { RolePermission } from '@app/models/RolePermission'

/** Permission names granted to a role (plucked — no full models, no table scan). */
export async function rolePermissionNames (roleId: string): Promise<string[]> {
    const ids = toArray(await RolePermission.where({ roleId }).pluck('permissionId'))
    if (ids.length === 0) return []

    return toArray(await Permission.query().whereIn('id', ids).pluck('name'))
}

/** Replace a role's permission grants with exactly `names`. */
export async function setRolePermissions (roleId: string, names: string[]): Promise<void> {
    const wantedPerms = toArray(await Permission.query().whereIn('name', names as PermissionKey[]).get())
    const wanted = new Set(wantedPerms.map((p) => p.id))
    const existing = toArray(await RolePermission.where({ roleId }).get())
    const have = new Set(existing.map((r) => r.permissionId))

    for (const rp of existing) {
        if (!wanted.has(rp.permissionId)) await rp.delete()
    }
    for (const pid of wanted) {
        if (!have.has(pid)) await RolePermission.create({ roleId, permissionId: pid })
    }
}
