import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Keyed hashes of a session's document and identity, matched across sessions in
 * an organization to find reused documents. They hold no raw identity data and
 * survive media retention.
 */
export default class CreateSessionFingerprintsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('session_fingerprints', (table) => {
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
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
      table.enum('kind', ['document', 'identity'])
      table.string('hash')
      table.string('userReference').nullable().map('user_reference')
      table.timestamps('camel', 'snake')
      table.unique(['sessionId', 'kind'])
      table.index(['organizationId', 'kind', 'hash'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('session_fingerprints')
  }
}
