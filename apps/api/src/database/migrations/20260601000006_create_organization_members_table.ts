import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateOrganizationMembersTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('organization_members', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('members')
      table
        .uuid('userId')
        .map('user_id')
        .foreign()
        .references('users', 'id')
        .onDelete('cascade')
        .as('user')
        .inverseAlias('organizationMemberships')
      table
        .uuid('roleId')
        .map('role_id')
        .foreign()
        .references('roles', 'id')
        .onDelete('restrict')
        .as('role')
        .inverseAlias('organizationMembers')
      table.string('status')
      table.date('joinedAt').nullable().map('joined_at')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
      table.unique(['organizationId', 'userId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('organization_members')
  }
}
