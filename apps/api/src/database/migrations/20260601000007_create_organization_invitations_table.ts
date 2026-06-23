import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateOrganizationInvitationsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('organization_invitations', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('invitations')
      table.string('email').index()
      table
        .uuid('roleId')
        .map('role_id')
        .foreign()
        .references('roles', 'id')
        .onDelete('restrict')
        .as('role')
        .inverseAlias('invitations')
      table.string('tokenHash').unique().map('token_hash')
      table.timestamp('expiresAt').map('expires_at')
      table.timestamp('acceptedAt').nullable().map('accepted_at')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('organization_invitations')
  }
}
