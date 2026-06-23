import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateReviewNotesTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('review_notes', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('reviewNotes')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('reviewNotes')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
        .as('session')
        .inverseAlias('reviewNotes')
      table
        .uuid('reviewerId')
        .map('reviewer_id')
        .foreign()
        .references('users', 'id')
        .onDelete('cascade')
        .as('reviewer')
        .inverseAlias('reviewNotes')
      table.text('note')
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('review_notes')
  }
}
