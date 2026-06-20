import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateWebhookEndpointsTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.createTable('webhook_endpoints', (table) => {
            table.id('id', 'uuid').primary()
            table.uuid('tenantId').map('tenant_id')
                .foreign().references('tenants', 'id').onDelete('cascade').as('tenant').inverseAlias('webhookEndpoints')
            table.uuid('projectId').map('project_id')
                .foreign().references('projects', 'id').onDelete('cascade').as('project').inverseAlias('webhookEndpoints')
            table.string('url')
            table.string('secretHash').map('secret_hash')
            table.json('events')
            table.string('status')
            table.timestamps('camel', 'snake')
            table.index(['projectId'])
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.dropTable('webhook_endpoints')
    }
}
