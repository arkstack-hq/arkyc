import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateTenantInvitationsTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.createTable('tenant_invitations', (table) => {
            table.id('id', 'uuid').primary()
            table.uuid('tenantId').map('tenant_id')
                .foreign().references('tenants', 'id').onDelete('cascade').as('tenant').inverseAlias('invitations')
            table.string('email').index()
            table.uuid('roleId').map('role_id')
                .foreign().references('roles', 'id').onDelete('restrict').as('role').inverseAlias('invitations')
            table.string('tokenHash').unique().map('token_hash')
            table.timestamp('expiresAt').map('expires_at')
            table.timestamp('acceptedAt').nullable().map('accepted_at')
            table.timestamps('camel', 'snake')
            table.index(['tenantId'])
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.dropTable('tenant_invitations')
    }
}
