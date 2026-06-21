import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateRolePermissionsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('role_permissions', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('roleId')
        .map('role_id')
        .foreign()
        .references('roles', 'id')
        .onDelete('cascade')
        .as('role')
        .inverseAlias('rolePermissions')
      table
        .uuid('permissionId')
        .map('permission_id')
        .foreign()
        .references('permissions', 'id')
        .onDelete('cascade')
        .as('permission')
        .inverseAlias('rolePermissions')
      table.timestamps('camel', 'snake')
      table.unique(['roleId', 'permissionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('role_permissions')
  }
}
