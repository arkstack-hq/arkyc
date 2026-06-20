import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateAuditLogsTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.createTable('audit_logs', (table) => {
            table.id('id', 'uuid').primary()
            table.uuid('tenantId').map('tenant_id')
                .foreign().references('tenants', 'id').onDelete('cascade').as('tenant').inverseAlias('auditLogs')
            table.uuid('projectId').nullable().map('project_id')
                .foreign().references('projects', 'id').onDelete('cascade').as('project').inverseAlias('auditLogs')
            table.uuid('actorId').nullable().map('actor_id')
            table.string('actorType').map('actor_type')
            table.string('action').index()
            table.string('entityType').map('entity_type')
            table.uuid('entityId').nullable().map('entity_id')
            table.json('metadata').nullable()
            table.string('ipAddress').nullable().map('ip_address')
            table.string('userAgent').nullable().map('user_agent')
            table.timestamps('camel', 'snake')
            table.index(['tenantId', 'createdAt'])
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.dropTable('audit_logs')
    }
}
