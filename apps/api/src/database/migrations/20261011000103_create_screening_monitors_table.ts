import { Migration, SchemaBuilder } from 'arkormx'

/** Completed sessions whose identity is re-screened on a schedule. */
export default class CreateScreeningMonitorsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('screening_monitors', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
      table.uuid('projectId').map('project_id').foreign().references('projects', 'id').onDelete('cascade')
      table
        .uuid('sessionId')
        .map('session_id')
        .unique()
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
      table.float('threshold')
      table.json('knownEntityIds').nullable().map('known_entity_ids')
      table.boolean('active').default(true)
      table.timestamp('lastScreenedAt').nullable().map('last_screened_at')
      table.timestamp('nextScreenAt').map('next_screen_at')
      table.timestamps('camel', 'snake')
      table.index(['active', 'nextScreenAt'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('screening_monitors')
  }
}
