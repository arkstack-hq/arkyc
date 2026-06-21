import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateOcrResultsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('ocr_results', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('tenantId')
        .map('tenant_id')
        .foreign()
        .references('tenants', 'id')
        .onDelete('cascade')
        .as('tenant')
        .inverseAlias('ocrResults')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('ocrResults')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
        .as('session')
        .inverseAlias('ocrResults')
      table
        .uuid('documentCaptureId')
        .map('document_capture_id')
        .foreign()
        .references('document_captures', 'id')
        .onDelete('cascade')
        .as('documentCapture')
        .inverseAlias('ocrResults')
      table.json('fields')
      table.float('confidence')
      table.json('rawResponse').nullable().map('raw_response')
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('ocr_results')
  }
}
