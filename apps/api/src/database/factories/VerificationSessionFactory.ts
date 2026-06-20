import { ModelFactory } from '@arkstack/database'
import { VerificationSession } from '@app/models/VerificationSession'
import { faker } from '@faker-js/faker'

/** `tenantId` and `projectId` must be supplied as overrides when creating. */
export class VerificationSessionFactory extends ModelFactory<VerificationSession> {
    protected model = VerificationSession

    protected definition (sequence: number) {
        return {
            userReference: `user_${sequence}`,
            status: 'pending' as const,
            expiresAt: faker.date.soon({ days: 1 }),
            metadata: {},
        }
    }
}
