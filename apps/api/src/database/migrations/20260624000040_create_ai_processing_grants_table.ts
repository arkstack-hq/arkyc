import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateAiProcessingGrantsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    // One row per project tracking AI-processing access. AI OCR is a gated
    // capability: project owners request it (`pending`), platform admins grant
    // (`granted`) or revoke (`revoked`) it. No row means never requested.
    schema.createTable('ai_processing_grants', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
      table
        .uuid('projectId')
        .map('project_id')
        .unique()
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('aiProcessingGrant')
      table.string('status')
      table.text('note').nullable()
      // Actor ids are plain references (no FK) for display/traceability only.
      table.uuid('requestedBy').nullable().map('requested_by')
      table.timestamp('requestedAt').nullable().map('requested_at')
      table.uuid('reviewedBy').nullable().map('reviewed_by')
      table.timestamp('reviewedAt').nullable().map('reviewed_at')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
      table.index(['status'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('ai_processing_grants')
  }
}
