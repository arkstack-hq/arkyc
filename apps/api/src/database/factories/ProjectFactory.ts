import { ApiKey } from 'src/app/models/ApiKey'
import { ApiKey as ApiKeyAuth } from '@arkyc/auth'
import { ModelFactory } from '@arkstack/database'
import { Project } from '@app/models/Project'
import { VerificationSession } from 'src/app/models/VerificationSession'
import { VerificationStatus } from '@arkyc/types'
import { faker } from '@faker-js/faker'

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

/** `tenantId` must be supplied as an override when creating. */
export class ProjectFactory extends ModelFactory<Project> {
  protected model = Project

  protected definition(sequence: number) {
    const name = faker.commerce.productName()

    return {
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${sequence}`,
      environment: 'production' as const,
      settings: {},
      branding: {},
      status: 'active' as const,
    }
  }


  protected configure() {
    this.afterCreating(async (project) => {
      await project.load('tenant')
      const tenant = project.getAttribute('tenant')!

      const key = ApiKeyAuth.generate(project.environment === 'production' ? 'live' : 'test')
      await ApiKey.create({
        tenantId: tenant.id,
        projectId: project.id,
        name: 'Default key',
        keyPrefix: key.keyPrefix,
        keyHash: key.keyHash,
      })

      // One fixture session per status, all under the production project.
      for (const status of SESSION_STATUSES) {
        await VerificationSession.create({
          tenantId: tenant.id,
          projectId: project.id,
          userReference: `user_${status}_${project.id}`,
          status,
          expiresAt: faker.date.soon({ days: 1 }),
          metadata: { seeded: true },
        })
      }
    })
  }
}
