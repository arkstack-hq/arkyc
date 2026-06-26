import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateAddressVerificationsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('address_verifications', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('addressVerifications')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('addressVerifications')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
        .as('session')
        .inverseAlias('addressVerifications')
      table.json('claimedAddress').nullable().map('claimed_address')
      table.string('documentImagePath').nullable().map('document_image_path')
      table.float('latitude').nullable()
      table.float('longitude').nullable()
      table.boolean('passed')
      table.float('score')
      table.json('methods')
      table.string('provider')
      table.json('rawResponse').nullable().map('raw_response')
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('address_verifications')
  }
}
