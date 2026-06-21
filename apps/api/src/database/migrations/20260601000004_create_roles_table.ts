import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateRolesTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('roles', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('tenantId')
        .map('tenant_id')
        .foreign()
        .references('tenants', 'id')
        .onDelete('cascade')
        .as('tenant')
        .inverseAlias('roles')
      table.string('name')
      table.string('slug')
      table.string('description').nullable()
      table.boolean('isSystem').map('is_system')
      table.timestamps('camel', 'snake')
      table.index(['tenantId'])
      table.unique(['tenantId', 'slug'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('roles')
  }
}
