import type {
  AdminResolutionContext,
  AdminResolverStore,
  AdminRoleDefinition,
  AdminSyncStore,
  DefaultRoleDefinition,
  PermissionDefinition,
  PermissionResolutionContext,
  PermissionResolverStore,
  PermissionSyncStore,
} from '@arkyc/permissions'
import type { AdminPermissionKey, AnyPermissionKey, PermissionKey } from '@arkyc/types'
import { TenantMember } from '@app/models/TenantMember'
import { ProjectMember } from '@app/models/ProjectMember'
import { UserPermission } from '@app/models/UserPermission'
import { AdminPermission } from '@app/models/AdminPermission'
import { RolePermission } from '@app/models/RolePermission'
import { Permission } from '@app/models/Permission'
import { Role } from '@app/models/Role'

function toArray<T>(collection: Iterable<T> | null | undefined): T[] {
  return collection ? Array.from(collection) : []
}

/** A lazily-typed eager-loaded relation (model instance or related collection). */
type Loaded = { getAttribute(key: string): unknown } | null | undefined

/**
 * Arkormˣ-backed implementation of the `@arkyc/permissions` resolver port.
 *
 * Resolution leans on relationship eager-loaders: a member is loaded with its
 * `role.permissions` (or a user permission with its `permission`) in one query,
 * so the permission names come straight off the loaded relations — no id→name
 * round-trip, no N+1.
 */
export class ArkormPermissionStore
  implements PermissionResolverStore, PermissionSyncStore, AdminResolverStore, AdminSyncStore {
  async tenantRolePermissions(ctx: PermissionResolutionContext): Promise<PermissionKey[]> {
    const member = await TenantMember.where({ userId: ctx.userId, tenantId: ctx.tenantId })
      .with('role.permissions')
      .first()

    return this.roleNames(member?.getAttribute('role') as Loaded) as PermissionKey[]
  }

  async projectRolePermissions(ctx: PermissionResolutionContext): Promise<PermissionKey[]> {
    if (!ctx.projectId) return []
    const member = await ProjectMember.where({ userId: ctx.userId, projectId: ctx.projectId })
      .with('role.permissions')
      .first()

    return this.roleNames(member?.getAttribute('role') as Loaded) as PermissionKey[]
  }

  async directPermissions(ctx: PermissionResolutionContext): Promise<PermissionKey[]> {
    const grants = toArray(
      await UserPermission.where({ userId: ctx.userId, tenantId: ctx.tenantId })
        .with('permission')
        .get(),
    )

    return grants
      .filter((g) => g.projectId == null || g.projectId === ctx.projectId)
      .map((g) => (g.getAttribute('permission') as Loaded)?.getAttribute('name') as PermissionKey)
      .filter(Boolean)
  }

  /** Permission names off a role's eager-loaded `permissions` relation. */
  private roleNames(role: Loaded): AnyPermissionKey[] {
    return toArray(role?.getAttribute('permissions') as Iterable<Loaded>)
      .map((p) => p?.getAttribute('name') as AnyPermissionKey)
      .filter(Boolean)
  }

  // ── AdminResolverStore ────────────────────────────────────────────────────

  async adminRolePermissions(ctx: AdminResolutionContext): Promise<AdminPermissionKey[]> {
    const grants = toArray(
      await AdminPermission.where({ userId: ctx.userId }).with('role.permissions').get(),
    )

    return (
      grants
        .map((g) => g.getAttribute('role') as Loaded)
        // Only admin roles contribute admin access; a tenant role never can.
        .filter((role) => role != null && role.getAttribute('admin') === true)
        .flatMap((role) => this.roleNames(role) as AdminPermissionKey[])
    )
  }

  async adminDirectPermissions(ctx: AdminResolutionContext): Promise<AdminPermissionKey[]> {
    const grants = toArray(
      await AdminPermission.where({ userId: ctx.userId }).with('permission').get(),
    )

    return grants
      .filter((g) => g.roleId == null && g.permissionId != null)
      .map(
        (g) => (g.getAttribute('permission') as Loaded)?.getAttribute('name') as AdminPermissionKey,
      )
      .filter(Boolean)
  }

  // ── PermissionSyncStore ───────────────────────────────────────────────────

  async upsertPermission(def: PermissionDefinition): Promise<void> {
    const admin = def.admin ?? false
    const existing = await Permission.where({ name: def.name }).first()
    if (existing) {
      existing.description = def.description
      existing.group = def.group
      existing.admin = admin
      await existing.save()

      return
    }
    await Permission.create({
      name: def.name,
      description: def.description,
      group: def.group,
      admin,
    })
  }

  async upsertSystemRole(tenantId: string, role: DefaultRoleDefinition): Promise<string> {
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

  async upsertAdminRole(role: AdminRoleDefinition): Promise<string> {
    const existing = await Role.where({ slug: role.slug, admin: true }).first()
    if (existing) {
      existing.name = role.name
      existing.description = role.description
      existing.isSystem = true
      await existing.save()

      return existing.id
    }
    const created = await Role.create({
      tenantId: null,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: true,
      admin: true,
    })

    return created.id
  }

  async syncRolePermissions(
    roleId: string,
    permissions: readonly AnyPermissionKey[],
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
