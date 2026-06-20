import type { Request, Response } from 'express'
import { Auth } from '@arkstack/auth'
import { Hash } from '@arkstack/common'
import { hashToken } from '@arkyc/auth'
import { success, failure } from 'src/support/responses'
import { User } from '@app/models/User'
import { TenantInvitation } from '@app/models/TenantInvitation'
import { TenantMember } from '@app/models/TenantMember'

type Ctx = { req: Request; res: Response }

/** A user shape safe to return to clients (no credential material). */
function publicUser (user: User) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        createdAt: user.createdAt,
    }
}

/** POST /v1/auth/register — create an account and return a bearer token. */
export async function register ({ req, res }: Ctx) {
    const { name, email, password } = (req.body ?? {}) as Record<string, string>
    if (!name || !email || !password) {
        return failure(res, 422, 'name, email and password are required')
    }

    const existing = await User.where({ email }).first()
    if (existing) {
        return failure(res, 409, 'Email is already registered')
    }

    const user = await User.create({ name, email, password: await Hash.make(password) })
    const token = await Auth.make().setRequest(req).create(user)

    return success(res, { user: publicUser(user), token: token.token }, 'Registered', 201)
}

/** POST /v1/auth/login — verify credentials and return a bearer token. */
export async function login ({ req, res }: Ctx) {
    const { email, password } = (req.body ?? {}) as Record<string, string>
    if (!email || !password) {
        return failure(res, 422, 'email and password are required')
    }

    try {
        const auth = Auth.make().setRequest(req)
        const user = await auth.attempt(email, password)
        const token = await auth.create(user)

        user.lastLoginAt = new Date()
        await user.save()

        return success(res, { user: publicUser(user), token: token.token }, 'Logged in')
    } catch {
        return failure(res, 401, 'Invalid credentials')
    }
}

/** GET /v1/auth/me — the currently authenticated user. */
export function me ({ req, res }: Ctx) {
    if (!req.authUser) return failure(res, 401, 'Unauthenticated')

    return success(res, { user: publicUser(req.authUser) })
}

/** POST /v1/auth/logout — revoke the current session token. */
export async function logout ({ req, res }: Ctx) {
    if (req.auth) await req.auth.logout(req.authToken)

    return success(res, null, 'Logged out')
}

/** POST /v1/auth/invitations/accept — accept a tenant invitation by token. */
export async function acceptInvitation ({ req, res }: Ctx) {
    const user = req.authUser
    if (!user) return failure(res, 401, 'Unauthenticated')

    const { token } = (req.body ?? {}) as Record<string, string>
    if (!token) return failure(res, 422, 'token is required')

    const invitation = await TenantInvitation.where({ tokenHash: hashToken(token) }).first()
    if (!invitation || invitation.acceptedAt) {
        return failure(res, 404, 'Invitation not found')
    }
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
        return failure(res, 410, 'Invitation has expired')
    }
    if (invitation.email !== user.email) {
        return failure(res, 403, 'This invitation is for a different email')
    }

    const existing = await TenantMember.where({
        userId: user.id,
        tenantId: invitation.tenantId,
    }).first()
    if (!existing) {
        await TenantMember.create({
            tenantId: invitation.tenantId,
            userId: user.id,
            roleId: invitation.roleId,
            status: 'active',
            joinedAt: new Date(),
        })
    }

    invitation.acceptedAt = new Date()
    await invitation.save()

    return success(res, null, 'Invitation accepted')
}
