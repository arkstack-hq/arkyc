import { ModelFactory } from '@arkstack/database'
import { Project } from '@app/models/Project'
import { faker } from '@faker-js/faker'

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
}
