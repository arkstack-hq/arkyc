import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Platform-admin grants (Phase 15). Mirrors `user_permissions` but without
 * tenant/project scope: a row is EITHER a role grant (`role_id`) or a direct
 * permission grant (`permission_id`). Used to grant the first platform owner
 * ("sync ownership") and resolved by the `canAdmin` guard.
 */
export default class CreateAdminPermissionsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('admin_permissions', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('userId')
        .map('user_id')
        .foreign()
        .references('users', 'id')
        .onDelete('cascade')
        .as('user')
        .inverseAlias('adminPermissions')
      table
        .uuid('permissionId')
        .nullable()
        .map('permission_id')
        .foreign()
        .references('permissions', 'id')
        .onDelete('cascade')
        .as('permission')
        .inverseAlias('adminPermissions')
      table
        .uuid('roleId')
        .nullable()
        .map('role_id')
        .foreign()
        .references('roles', 'id')
        .onDelete('cascade')
        .as('role')
        .inverseAlias('adminPermissions')
      table.timestamps('camel', 'snake')
      table.index(['userId'])
      table.unique(['userId', 'permissionId', 'roleId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('admin_permissions')
  }
}
