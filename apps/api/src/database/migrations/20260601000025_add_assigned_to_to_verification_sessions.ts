import { Migration, SchemaBuilder } from 'arkormx'

/** Reviewer assignment (Phase 9): which user a session is assigned to for review. */
export default class AddAssignedToToVerificationSessionsMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.uuid('assignedTo').nullable().map('assigned_to')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.dropColumn('assigned_to')
    })
  }
}
