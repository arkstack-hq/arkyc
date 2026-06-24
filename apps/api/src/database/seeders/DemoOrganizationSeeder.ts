import { SchemaBuilder, Seeder } from '@arkstack/database'

import type { AnyPermissionKey } from '@arkyc/types'
import { DefaultRoles } from '@arkyc/permissions'
import { Organization } from 'src/app/models/Organization'
import { OrganizationFactory } from '../factories/OrganizationFactory'
import { Permission } from 'src/app/models/Permission'
import { Project } from 'src/app/models/Project'
import { Role } from 'src/app/models/Role'
import { RolePermission } from 'src/app/models/RolePermission'
import { User } from 'src/app/models/User'

/**
 * Seed a complete demo workspace: an organization with the five system roles (and
 * their permissions), an owner member, two projects with API keys, and one
 * verification session per status.
 */
export class DemoOrganizationSeeder extends Seeder {
  public async run(): Promise<void> {
    const organization = await Organization.factory<OrganizationFactory>(1).create()

    // Build a permission-name → id lookup once to avoid per-grant queries.
    const permissions = Array.from(await Permission.all())
    const permissionId = new Map<AnyPermissionKey, string>(permissions.map((p) => [p.name, p.id]))

    const roleBySlug = new Map<string, Role>()
    for (const def of DefaultRoles.ALL) {
      const role = await Role.create({
        organizationId: organization.id,
        name: def.name,
        slug: def.slug,
        description: def.description,
        isSystem: true,
      })
      roleBySlug.set(def.slug, role)

      for (const permKey of def.permissions) {
        const id = permissionId.get(permKey)
        if (id) {
          await RolePermission.create({ roleId: role.id, permissionId: id })
        }
      }
    }

    await SchemaBuilder.disableForeignKeyConstraints()
    await User.factory()
      .hasAttached(
        Organization.factory().has(Project.factory(3)),
        {
          status: 'active',
          roleId: roleBySlug.get('owner')!.id,
        },
        'organizationMemberships',
      )
      .create()
    await SchemaBuilder.enableForeignKeyConstraints()
  }
}
