import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateUserPermissionsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('user_permissions', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('userPermissions')
      table
        .uuid('projectId')
        .nullable()
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('userPermissions')
      table
        .uuid('userId')
        .map('user_id')
        .foreign()
        .references('users', 'id')
        .onDelete('cascade')
        .as('user')
        .inverseAlias('directPermissions')
      table
        .uuid('permissionId')
        .map('permission_id')
        .foreign()
        .references('permissions', 'id')
        .onDelete('cascade')
        .as('permission')
        .inverseAlias('userPermissions')
      table.timestamps('camel', 'snake')
      table.index(['organizationId', 'userId'])
      table.unique(['organizationId', 'projectId', 'userId', 'permissionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('user_permissions')
  }
}
