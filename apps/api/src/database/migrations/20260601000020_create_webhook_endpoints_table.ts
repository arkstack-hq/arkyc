import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateWebhookEndpointsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('webhook_endpoints', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('webhookEndpoints')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('webhookEndpoints')
      table.string('url')
      table.string('secretHash').map('secret_hash')
      table.json('events')
      table.string('status')
      table.timestamps('camel', 'snake')
      table.index(['projectId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('webhook_endpoints')
  }
}
