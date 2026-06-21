/**
 * @arkyc/permissions
 *
 * Role-based access control for Arkyc: the permission catalogue and default
 * system roles (data), plus the resolver, checks, sync helpers, and a custom
 * permission registry. DB-agnostic — database access is injected through the
 * store ports in `./types`, so this package is reusable by the api, dashboard,
 * and sdk.
 */
export * from './catalogue'
export * from './default-roles'
export * from './types'
export * from './check'
export * from './define'
export * from './sync'
