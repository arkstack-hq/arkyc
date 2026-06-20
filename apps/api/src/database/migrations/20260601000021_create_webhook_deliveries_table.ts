import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateWebhookDeliveriesTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.createTable('webhook_deliveries', (table) => {
            table.id('id', 'uuid').primary()
            table.uuid('tenantId').map('tenant_id')
                .foreign().references('tenants', 'id').onDelete('cascade').as('tenant').inverseAlias('webhookDeliveries')
            table.uuid('projectId').map('project_id')
                .foreign().references('projects', 'id').onDelete('cascade').as('project').inverseAlias('webhookDeliveries')
            table.uuid('webhookEndpointId').map('webhook_endpoint_id')
                .foreign().references('webhook_endpoints', 'id').onDelete('cascade').as('endpoint').inverseAlias('deliveries')
            table.string('event')
            table.json('payload')
            table.string('status').index()
            table.integer('responseStatus').nullable().map('response_status')
            table.text('responseBody').nullable().map('response_body')
            table.integer('attempts')
            table.timestamp('nextRetryAt').nullable().map('next_retry_at')
            table.timestamps('camel', 'snake')
            table.index(['webhookEndpointId'])
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.dropTable('webhook_deliveries')
    }
}
