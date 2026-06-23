import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateRolesTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('roles', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('roles')
      table.string('name')
      table.string('slug')
      table.string('description').nullable()
      table.boolean('isSystem').map('is_system')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
      table.unique(['organizationId', 'slug'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('roles')
  }
}
