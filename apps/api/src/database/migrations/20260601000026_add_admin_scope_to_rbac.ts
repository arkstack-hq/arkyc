import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Extend the RBAC tables with a platform-admin scope (Phase 15):
 *   - `permissions.admin` / `roles.admin` flags — `true` rows are platform-scope
 *     (the super-admin surface above organizations); `false` is the existing organization RBAC.
 *   - `roles.organization_id` becomes NULLABLE so platform-admin roles aren't tied to a
 *     organization. The migration engine has no "change nullability" op, so the column
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

    // Drop organization_id (and, with it, its FK + index + unique constraint)…
    schema.alterTable('roles', (table) => {
      table.dropColumn('organization_id')
    })

    // …then re-add it nullable, restoring the FK, index, and unique constraint.
    schema.alterTable('roles', (table) => {
      table
        .uuid('organizationId')
        .nullable()
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('roles')
      table.index(['organizationId'])
      table.unique(['organizationId', 'slug'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    // Restores the original NOT NULL `organization_id`. This is the true inverse, so it
    // requires no platform-admin (NULL-organization) roles to remain — consistent with
    // rolling the whole feature back. Run via `ark migrate:fresh` for a rebuild.
    schema.alterTable('roles', (table) => {
      table.dropColumn('organization_id')
    })

    schema.alterTable('roles', (table) => {
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('roles')
      table.index(['organizationId'])
      table.unique(['organizationId', 'slug'])
    })

    schema.alterTable('roles', (table) => {
      table.dropColumn('admin')
    })

    schema.alterTable('permissions', (table) => {
      table.dropColumn('admin')
    })
  }
}
