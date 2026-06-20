import type {
    DefaultRoleDefinition,
    PermissionDefinition,
    PermissionResolutionContext,
    PermissionResolverStore,
    PermissionSyncStore,
} from '@arkyc/permissions'
import type { PermissionKey } from '@arkyc/types'
import { TenantMember } from '@app/models/TenantMember'
import { ProjectMember } from '@app/models/ProjectMember'
import { UserPermission } from '@app/models/UserPermission'
import { RolePermission } from '@app/models/RolePermission'
import { Permission } from '@app/models/Permission'
import { Role } from '@app/models/Role'

function toArray<T> (collection: Iterable<T> | null | undefined): T[] {
    return collection ? Array.from(collection) : []
}

/**
 * Arkormˣ-backed implementation of the `@arkyc/permissions` resolver port.
 *
 * The permission table is tiny (the catalogue), so role/direct grants are
 * resolved with a couple of bulk queries and an id→name map rather than a join
 * per grant — keeping resolution to O(1) queries and avoiding N+1.
 */
export class ArkormPermissionStore implements PermissionResolverStore, PermissionSyncStore {
    async tenantRolePermissions (ctx: PermissionResolutionContext): Promise<PermissionKey[]> {
        const member = await TenantMember.where({
            userId: ctx.userId,
            tenantId: ctx.tenantId,
        }).first()
        if (!member) return []

        return this.permissionsForRole(member.roleId)
    }

    async projectRolePermissions (ctx: PermissionResolutionContext): Promise<PermissionKey[]> {
        if (!ctx.projectId) return []
        const member = await ProjectMember.where({
            userId: ctx.userId,
            projectId: ctx.projectId,
        }).first()
        if (!member) return []

        return this.permissionsForRole(member.roleId)
    }

    async directPermissions (ctx: PermissionResolutionContext): Promise<PermissionKey[]> {
        const grants = toArray(
            await UserPermission.where({ userId: ctx.userId, tenantId: ctx.tenantId }).get(),
        )
        const relevant = grants.filter(
            (g) => g.projectId == null || g.projectId === ctx.projectId,
        )

        return this.namesFor(relevant.map((g) => g.permissionId))
    }

    private async permissionsForRole (roleId: string): Promise<PermissionKey[]> {
        const permissionIds = toArray(await RolePermission.where({ roleId }).pluck('permissionId'))

        return this.namesFor(permissionIds)
    }

    private async namesFor (permissionIds: string[]): Promise<PermissionKey[]> {
        if (permissionIds.length === 0) return []

        // Pluck just the names of the wanted permissions — no full models, no
        // table scan.
        return toArray(await Permission.query().whereIn('id', permissionIds).pluck('name'))
    }

    // ── PermissionSyncStore ───────────────────────────────────────────────────

    async upsertPermission (def: PermissionDefinition): Promise<void> {
        const existing = await Permission.where({ name: def.name }).first()
        if (existing) {
            existing.description = def.description
            existing.group = def.group
            await existing.save()

            return
        }
        await Permission.create({ name: def.name, description: def.description, group: def.group })
    }

    async upsertSystemRole (tenantId: string, role: DefaultRoleDefinition): Promise<string> {
        const existing = await Role.where({ tenantId, slug: role.slug }).first()
        if (existing) {
            existing.name = role.name
            existing.description = role.description
            existing.isSystem = true
            await existing.save()

            return existing.id
        }
        const created = await Role.create({
            tenantId,
            name: role.name,
            slug: role.slug,
            description: role.description,
            isSystem: true,
        })

        return created.id
    }

    async syncRolePermissions (
        roleId: string,
        permissions: readonly PermissionKey[],
    ): Promise<void> {
        const all = toArray(await Permission.all())
        const idByName = new Map(all.map((p) => [p.name, p.id]))
        const existing = toArray(await RolePermission.where({ roleId }).get())
        const have = new Set(existing.map((r) => r.permissionId))

        for (const name of permissions) {
            const permissionId = idByName.get(name)
            if (permissionId && !have.has(permissionId)) {
                await RolePermission.create({ roleId, permissionId })
            }
        }
    }
}

/** Shared singleton store used by the authorize middleware. */
export const permissionStore = new ArkormPermissionStore()
