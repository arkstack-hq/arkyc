import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Extend the RBAC tables with a platform-admin scope (Phase 15):
 *   - `permissions.admin` / `roles.admin` flags — `true` rows are platform-scope
 *     (the super-admin surface above tenants); `false` is the existing tenant RBAC.
 *   - `roles.tenant_id` becomes NULLABLE so platform-admin roles aren't tied to a
 *     tenant. The migration engine has no "change nullability" op, so the column
 *     is dropped and re-added nullable. `add` runs before `drop` within a single
 *     `alterTable`, so the two halves are separate `alterTable` calls; dropping
 *     the column also drops its FK/index/unique, which are then re-added.
 *
 * Run with `ark migrate:fresh` (migrations apply before seeders, so no data loss).
 */
export default class AddAdminScopeToRbacMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('permissions', (table) => {
      table.boolean('admin').default(false)
    })

    schema.alterTable('roles', (table) => {
      table.boolean('admin').default(false)
    })

    // Drop tenant_id (and, with it, its FK + index + unique constraint)…
    schema.alterTable('roles', (table) => {
      table.dropColumn('tenant_id')
    })

    // …then re-add it nullable, restoring the FK, index, and unique constraint.
    schema.alterTable('roles', (table) => {
      table
        .uuid('tenantId')
        .nullable()
        .map('tenant_id')
        .foreign()
        .references('tenants', 'id')
        .onDelete('cascade')
        .as('tenant')
        .inverseAlias('roles')
      table.index(['tenantId'])
      table.unique(['tenantId', 'slug'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    // Restores the original NOT NULL `tenant_id`. This is the true inverse, so it
    // requires no platform-admin (NULL-tenant) roles to remain — consistent with
    // rolling the whole feature back. Run via `ark migrate:fresh` for a rebuild.
    schema.alterTable('roles', (table) => {
      table.dropColumn('tenant_id')
    })

    schema.alterTable('roles', (table) => {
      table
        .uuid('tenantId')
        .map('tenant_id')
        .foreign()
        .references('tenants', 'id')
        .onDelete('cascade')
        .as('tenant')
        .inverseAlias('roles')
      table.index(['tenantId'])
      table.unique(['tenantId', 'slug'])
    })

    schema.alterTable('roles', (table) => {
      table.dropColumn('admin')
    })

    schema.alterTable('permissions', (table) => {
      table.dropColumn('admin')
    })
  }
}
