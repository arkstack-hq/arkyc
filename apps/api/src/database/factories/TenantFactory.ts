import { ModelFactory } from '@arkstack/database'
import { Tenant } from '@app/models/Tenant'
import { faker } from '@faker-js/faker'

export class TenantFactory extends ModelFactory<Tenant> {
    protected model = Tenant

    protected definition (sequence: number) {
        const name = faker.company.name()
        
return {
            name,
            slug: `${faker.helpers.slugify(name).toLowerCase()}-${sequence}`,
            logoUrl: null,
            settings: { retention_days: 90 },
        }
    }
}
