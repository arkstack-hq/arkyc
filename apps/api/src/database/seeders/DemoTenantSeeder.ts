import { Seeder } from '@arkstack/database'
import { Hash } from '@arkstack/common'
import { faker } from '@faker-js/faker'
import { DEFAULT_ROLES } from '@arkyc/permissions'
import { generateApiKey } from '@arkyc/auth'
import type { PermissionKey, VerificationStatus } from '@arkyc/types'
import { Tenant } from 'src/app/models/Tenant'
import { Role } from 'src/app/models/Role'
import { Permission } from 'src/app/models/Permission'
import { RolePermission } from 'src/app/models/RolePermission'
import { TenantMember } from 'src/app/models/TenantMember'
import { Project } from 'src/app/models/Project'
import { ApiKey } from 'src/app/models/ApiKey'
import { User } from 'src/app/models/User'
import { VerificationSession } from 'src/app/models/VerificationSession'

const SESSION_STATUSES: VerificationStatus[] = [
    'pending',
    'started',
    'document_submitted',
    'liveness_submitted',
    'processing',
    'requires_review',
    'approved',
    'rejected',
    'expired',
    'cancelled',
]

/**
 * Seed a complete demo workspace: a tenant with the five system roles (and
 * their permissions), an owner member, two projects with API keys, and one
 * verification session per status.
 */
export class DemoTenantSeeder extends Seeder {
    public async run (): Promise<void> {
        const tenant = await Tenant.create({
            name: 'Acme Inc',
            slug: 'acme',
            logoUrl: null,
            settings: { retention_days: 90 },
        })

        // Build a permission-name → id lookup once to avoid per-grant queries.
        const permissions = Array.from(await Permission.all())
        const permissionId = new Map<PermissionKey, string>(
            permissions.map((p) => [p.name, p.id]),
        )

        const roleBySlug = new Map<string, Role>()
        for (const def of DEFAULT_ROLES) {
            const role = await Role.create({
                tenantId: tenant.id,
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

        const owner = await User.create({
            name: 'Acme Owner',
            email: 'owner@acme.test',
            password: await Hash.make('password'),
        })
        await TenantMember.create({
            tenantId: tenant.id,
            userId: owner.id,
            roleId: roleBySlug.get('owner')!.id,
            status: 'active',
            joinedAt: new Date(),
        })

        const production = await Project.factory().create({
            tenantId: tenant.id,
            name: 'Acme Web App - Production',
            slug: 'web-production',
            environment: 'production',
            status: 'active',
        })
        const staging = await Project.factory().create({
            tenantId: tenant.id,
            name: 'Acme Staging',
            slug: 'staging',
            environment: 'staging',
            status: 'active',
        })

        for (const project of [production, staging]) {
            const key = generateApiKey(project.environment === 'production' ? 'live' : 'test')
            await ApiKey.create({
                tenantId: tenant.id,
                projectId: project.id,
                name: 'Default key',
                keyPrefix: key.keyPrefix,
                keyHash: key.keyHash,
            })
        }

        // One fixture session per status, all under the production project.
        for (const status of SESSION_STATUSES) {
            await VerificationSession.create({
                tenantId: tenant.id,
                projectId: production.id,
                userReference: `user_${status}`,
                status,
                expiresAt: faker.date.soon({ days: 1 }),
                metadata: { seeded: true },
            })
        }
    }
}
