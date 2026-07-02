import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Extended access: one row per `(project, capability)` tracking a gated
 * capability's request/review lifecycle. Generalizes the former
 * `ai_processing_grants` table (a single AI-OCR gate) into a capability-keyed
 * entitlement system: projects request one or more capabilities (`ai`, `pii`, …),
 * platform admins grant (`granted`) or revoke (`revoked`) each independently, and
 * the app enforces the grant at runtime. No row for a capability means never
 * requested.
 *
 * This supersedes and drops `ai_processing_grants`. That table was introduced in
 * the same pre-release cycle and holds no production data, so grants are not
 * backfilled; projects re-request under the new model.
 */
export default class CreateAccessGrantsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('access_grants', (table) => {
      table.id('id', 'uuid').primary()
      table.uuid('organizationId').map('organization_id').foreign().references('organizations', 'id').onDelete('cascade')
      table.uuid('projectId').map('project_id').foreign().references('projects', 'id').onDelete('cascade')
      // Which gated capability this grant is for (see ACCESS_CAPABILITIES).
      table.string('capability')
      table.string('status')
      // Capability-specific request detail (PII: categories, timing, justification).
      table.json('details').nullable()
      table.text('note').nullable()
      // Actor ids are plain references (no FK) for display/traceability only.
      table.uuid('requestedBy').nullable().map('requested_by')
      table.timestamp('requestedAt').nullable().map('requested_at')
      table.uuid('reviewedBy').nullable().map('reviewed_by')
      table.timestamp('reviewedAt').nullable().map('reviewed_at')
      table.timestamps('camel', 'snake')
      table.unique(['projectId', 'capability'])
      table.index(['organizationId'])
      table.index(['status'])
      table.index(['capability'])
    })

    schema.dropTable('ai_processing_grants')
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    // Recreate the superseded single-capability table so the migration is reversible.
    schema.createTable('ai_processing_grants', (table) => {
      table.id('id', 'uuid').primary()
      table.uuid('organizationId').map('organization_id').foreign().references('organizations', 'id').onDelete('cascade')
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
      table.uuid('requestedBy').nullable().map('requested_by')
      table.timestamp('requestedAt').nullable().map('requested_at')
      table.uuid('reviewedBy').nullable().map('reviewed_by')
      table.timestamp('reviewedAt').nullable().map('reviewed_at')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
      table.index(['status'])
    })

    schema.dropTable('access_grants')
  }
}
