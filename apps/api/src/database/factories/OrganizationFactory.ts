import { ModelFactory } from '@arkstack/database'
import { Organization } from '@app/models/Organization'
import { faker } from '@faker-js/faker'

export class OrganizationFactory extends ModelFactory<Organization> {
  protected model = Organization

  protected definition(sequence: number) {
    const name = faker.company.name()

    return {
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${sequence}`,
      logoUrl: null,
      settings: { retention_days: 90 },
    }
  }
}
