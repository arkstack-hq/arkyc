/**
 * @arkyc/permissions
 *
 * Role-based access control for Arkyc. Phase 2 ships the static data: the
 * permission catalogue and default system-role definitions (used by seeders).
 * Phase 3 adds the resolver/authorizer/sync functions on top of this data.
 */
export * from './catalogue';
export * from './default-roles';
