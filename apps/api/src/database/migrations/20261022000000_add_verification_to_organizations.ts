import { Migration, SchemaBuilder } from 'arkormx'

/** Whether an organization has proven, as a business, that it may handle personal data. */
export default class AddVerificationToOrganizationsMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('organizations', (table) => {
      table
        .enum('verificationStatus', ['unverified', 'pending', 'verified', 'rejected'])
        .default('unverified')
        .map('verification_status')
      table.timestamp('verifiedAt').nullable().map('verified_at')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('organizations', (table) => {
      table.dropColumn('verification_status')
      table.dropColumn('verified_at')
    })
  }
}
