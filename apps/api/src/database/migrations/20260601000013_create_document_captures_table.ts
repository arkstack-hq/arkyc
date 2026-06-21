import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateDocumentCapturesTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('document_captures', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('tenantId')
        .map('tenant_id')
        .foreign()
        .references('tenants', 'id')
        .onDelete('cascade')
        .as('tenant')
        .inverseAlias('documentCaptures')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('documentCaptures')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
        .as('session')
        .inverseAlias('documentCaptures')
      table.string('country').nullable()
      table.string('documentType').nullable().map('document_type')
      table.string('frontImagePath').nullable().map('front_image_path')
      table.string('backImagePath').nullable().map('back_image_path')
      table.float('qualityScore').nullable().map('quality_score')
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('document_captures')
  }
}
