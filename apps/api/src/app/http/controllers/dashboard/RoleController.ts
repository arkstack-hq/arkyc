import { AppException } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { Str } from '@h3ravel/support'
import { BaseController } from '@controllers/BaseController'
import RoleResource from '@app/http/resources/RoleResource'
import RoleCollection from '@app/http/resources/RoleCollection'
import { rolePermissionNames, setRolePermissions } from '@app/services/permission-queries'
import { Role } from '@app/models/Role'

export default class RoleController extends BaseController {
    /**
     * List the active tenant's roles.
     *
     * @param   ctx  The HTTP context (`req.tenant`).
     * @returns      A RoleCollection.
     */
    async index ({ req }: HttpContext) {
        const roles = await Role.where({ tenantId: req.tenant!.id }).get()

        return new RoleCollection(roles).additional({ status: 'success', message: 'OK', code: 200 })
    }

    /**
     * Create a custom role with an optional permission set.
     *
     * @param   ctx  The HTTP context (`req.tenant`).
     * @returns      A RoleResource with its `permissions` (HTTP 201).
     */
    async create ({ req }: HttpContext) {
        const data = await this.validate({
            name: ['required', 'string', 'min:2'],
            slug: ['nullable', 'string'],
            description: ['nullable', 'string'],
            permissions: ['nullable', 'array'],
        })

        const slug = (data.slug || Str.slug(data.name)).toLowerCase()
        if (await Role.where({ tenantId: req.tenant!.id, slug }).first()) {
            throw new AppException('A role with this slug already exists', 409)
        }

        const role = await Role.create({
            tenantId: req.tenant!.id,
            name: data.name,
            slug,
            description: data.description ?? null,
            isSystem: false,
        })
        if (data.permissions) await setRolePermissions(role.id, data.permissions)

        return new RoleResource(role)
            .additional({
                status: 'success',
                message: 'Role created',
                code: 201,
                permissions: await rolePermissionNames(role.id),
            })
            .response()
            .setStatusCode(201)
    }

    /**
     * Show a role and its permission names.
     *
     * @param   ctx  The HTTP context (`:roleId`, `req.tenant`).
     * @returns      A RoleResource with its `permissions`.
     */
    async show ({ req }: HttpContext) {
        const role = await Role.where({ id: req.params.roleId, tenantId: req.tenant!.id }).firstOrFail()

        return new RoleResource(role).additional({
            status: 'success',
            message: 'OK',
            code: 200,
            permissions: await rolePermissionNames(role.id),
        })
    }

    /**
     * Update a role's name/description and (optionally) its permission set.
     *
     * @param   ctx  The HTTP context (`:roleId`, `req.tenant`).
     * @returns      A RoleResource with its `permissions`.
     */
    async update ({ req }: HttpContext) {
        const data = await this.validate({
            name: ['nullable', 'string'],
            description: ['nullable', 'string'],
            permissions: ['nullable', 'array'],
        })

        const role = await Role.where({ id: req.params.roleId, tenantId: req.tenant!.id }).firstOrFail()
        if (data.name) role.name = data.name
        if (data.description !== undefined) role.description = data.description
        await role.save()
        if (data.permissions) await setRolePermissions(role.id, data.permissions)

        return new RoleResource(role).additional({
            status: 'success',
            message: 'Role updated',
            code: 200,
            permissions: await rolePermissionNames(role.id),
        })
    }
}
