import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateProjectsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('projects', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('projects')
      table.string('name')
      table.string('slug')
      table.string('environment')
      table.json('settings').nullable()
      table.json('branding').nullable()
      table.string('status')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
      table.unique(['organizationId', 'slug'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('projects')
  }
}
