import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateDocumentPortraitsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('document_portraits', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('documentPortraits')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('documentPortraits')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
        .as('session')
        .inverseAlias('documentPortraits')
      table
        .uuid('documentCaptureId')
        .map('document_capture_id')
        .foreign()
        .references('document_captures', 'id')
        .onDelete('cascade')
        .as('documentCapture')
        .inverseAlias('portraits')
      table.string('portraitImagePath').map('portrait_image_path')
      table.float('detectionConfidence').map('detection_confidence')
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('document_portraits')
  }
}
