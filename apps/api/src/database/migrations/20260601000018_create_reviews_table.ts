import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateReviewsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('reviews', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('reviews')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('reviews')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
        .as('session')
        .inverseAlias('reviews')
      table
        .uuid('reviewerId')
        .nullable()
        .map('reviewer_id')
        .foreign()
        .references('users', 'id')
        .onDelete('setNull')
        .as('reviewer')
        .inverseAlias('reviews')
      table.string('previousStatus').map('previous_status')
      table.string('newStatus').map('new_status')
      table.string('reason').nullable()
      table.text('note').nullable()
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('reviews')
  }
}
