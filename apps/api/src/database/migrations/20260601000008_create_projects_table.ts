import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateProjectsTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.createTable('projects', (table) => {
            table.id('id', 'uuid').primary()
            table.uuid('tenantId').map('tenant_id')
                .foreign().references('tenants', 'id').onDelete('cascade').as('tenant').inverseAlias('projects')
            table.string('name')
            table.string('slug')
            table.string('environment')
            table.json('settings').nullable()
            table.json('branding').nullable()
            table.string('status')
            table.timestamps('camel', 'snake')
            table.index(['tenantId'])
            table.unique(['tenantId', 'slug'])
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.dropTable('projects')
    }
}
