import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateTenantMembersTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.createTable('tenant_members', (table) => {
            table.id('id', 'uuid').primary()
            table.uuid('tenantId').map('tenant_id')
                .foreign().references('tenants', 'id').onDelete('cascade').as('tenant').inverseAlias('members')
            table.uuid('userId').map('user_id')
                .foreign().references('users', 'id').onDelete('cascade').as('user').inverseAlias('tenantMemberships')
            table.uuid('roleId').map('role_id')
                .foreign().references('roles', 'id').onDelete('restrict').as('role').inverseAlias('tenantMembers')
            table.string('status')
            table.date('joinedAt').nullable().map('joined_at')
            table.timestamps('camel', 'snake')
            table.index(['tenantId'])
            table.unique(['tenantId', 'userId'])
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.dropTable('tenant_members')
    }
}
