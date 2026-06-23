import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateFaceMatchChecksTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('face_match_checks', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('faceMatchChecks')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('faceMatchChecks')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
        .as('session')
        .inverseAlias('faceMatchChecks')
      table.string('idPortraitImagePath').nullable().map('id_portrait_image_path')
      table.string('selfieImagePath').nullable().map('selfie_image_path')
      table.float('similarityScore').map('similarity_score')
      table.float('confidence')
      table.boolean('passed')
      table.string('provider')
      table.json('rawResponse').nullable().map('raw_response')
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('face_match_checks')
  }
}
