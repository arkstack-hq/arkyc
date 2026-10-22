import { Migration, SchemaBuilder } from 'arkormx'

/** When a project or organization was queued for deletion. */
export default class AddDeletionRequestedAtMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('projects', (table) => {
      table.timestamp('deletionRequestedAt').nullable().map('deletion_requested_at')
    })
    schema.alterTable('organizations', (table) => {
      table.timestamp('deletionRequestedAt').nullable().map('deletion_requested_at')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('projects', (table) => {
      table.dropColumn('deletion_requested_at')
    })
    schema.alterTable('organizations', (table) => {
      table.dropColumn('deletion_requested_at')
    })
  }
}
