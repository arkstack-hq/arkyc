import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateProjectMembersTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('project_members', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('projectMembers')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('members')
      table
        .uuid('userId')
        .map('user_id')
        .foreign()
        .references('users', 'id')
        .onDelete('cascade')
        .as('user')
        .inverseAlias('projectMemberships')
      table
        .uuid('roleId')
        .map('role_id')
        .foreign()
        .references('roles', 'id')
        .onDelete('restrict')
        .as('role')
        .inverseAlias('projectMembers')
      table.string('status')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
      table.index(['projectId'])
      table.unique(['projectId', 'userId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('project_members')
  }
}
