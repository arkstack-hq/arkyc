import { Migration, SchemaBuilder } from 'arkormx'

/** Business verification submissions and their review, one row per submission. */
export default class CreateBusinessVerificationsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('business_verifications', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
      table.enum('status', ['pending', 'approved', 'rejected']).default('pending')
      table.string('legalName').map('legal_name')
      table.string('country')
      table.string('registrationNumber').map('registration_number')
      table.text('registeredAddress').map('registered_address')
      table.string('website')
      table.string('dpoName').map('dpo_name')
      table.string('dpoEmail').map('dpo_email')
      table.string('privacyPolicyUrl').map('privacy_policy_url')
      table.string('dataProtectionRegistration').nullable().map('data_protection_registration')
      table.string('incorporationDocumentPath').nullable().map('incorporation_document_path')
      table.string('dataProtectionDocumentPath').nullable().map('data_protection_document_path')
      table.text('reviewNote').nullable().map('review_note')
      table.uuid('submittedBy').nullable().map('submitted_by')
      table.timestamp('submittedAt').map('submitted_at')
      table.uuid('reviewedBy').nullable().map('reviewed_by')
      table.timestamp('reviewedAt').nullable().map('reviewed_at')
      table.timestamps('camel', 'snake')
      table.index(['organizationId', 'createdAt'])
      table.index(['status'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('business_verifications')
  }
}
