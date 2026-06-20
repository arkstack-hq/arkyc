import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateLivenessChecksTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.createTable('liveness_checks', (table) => {
            table.id('id', 'uuid').primary()
            table.uuid('tenantId').map('tenant_id')
                .foreign().references('tenants', 'id').onDelete('cascade').as('tenant').inverseAlias('livenessChecks')
            table.uuid('projectId').map('project_id')
                .foreign().references('projects', 'id').onDelete('cascade').as('project').inverseAlias('livenessChecks')
            table.uuid('sessionId').map('session_id')
                .foreign().references('verification_sessions', 'id').onDelete('cascade').as('session').inverseAlias('livenessChecks')
            table.string('selfieImagePath').nullable().map('selfie_image_path')
            table.string('videoPath').nullable().map('video_path')
            table.float('score')
            table.boolean('passed')
            table.json('spoofSignals').nullable().map('spoof_signals')
            table.string('provider')
            table.json('rawResponse').nullable().map('raw_response')
            table.timestamps('camel', 'snake')
            table.index(['sessionId'])
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.dropTable('liveness_checks')
    }
}
