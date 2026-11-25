import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import request from 'parasito'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { NOTIFICATION_TYPE } from '@arkyc/types'
import { app } from '../src/core/bootstrap'
import { AdminPermission } from '../src/app/models/AdminPermission'
import { Organization } from '../src/app/models/Organization'
import { Permission } from '../src/app/models/Permission'
import { Role } from '../src/app/models/Role'
import { User } from '../src/app/models/User'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'

type Account = { id: string; token: string; email: string }

const fx = {
  owner: {} as Account,
  admin: {} as Account,
  accessAdmin: {} as Account,
  organizationId: '',
  projectId: '',
}

async function register(tag: string): Promise<Account> {
  const email = `arn-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.dev`
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: tag, lastname: 'Test', email, password: 'secret123' })

  return { id: res.body.data.id, token: res.body.token, email }
}

const call = (account: Account, method: 'get' | 'post', path: string) =>
  request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`)

async function notificationsOf(account: Account, type: string) {
  const res = await call(account, 'get', '/account/notifications?limit=100')

  return (res.body.data as Array<{ type: string; action_link: string | null }>).filter((n) => n.type === type)
}

/** Stored mails (file transport) addressed to `email` whose content mentions `text`. */
async function mailsTo(email: string, text: string): Promise<number> {
  const root = config('notifications.transports.file.directory') as string
  let count = 0

  for (const day of await readdir(root).catch(() => [] as string[])) {
    for (const file of await readdir(join(root, day))) {
      const body = await readFile(join(root, day, file), 'utf8')

      if (body.includes(email) && body.includes(text)) count++
    }
  }

  return count
}

beforeAll(async () => {
  fx.owner = await register('owner')
  fx.admin = await register('admin')
  fx.accessAdmin = await register('access-admin')

  await PermissionSync.adminPermissions(permissionStore)
  await PermissionSync.adminRoles(permissionStore)

  const role = await Role.where({ slug: AdminRoles.bySlug('platform-owner').slug, admin: true }).firstOrFail()
  const accessManage = await Permission.where({ name: 'admin.extended_access.manage' }).firstOrFail()

  await AdminPermission.create({ userId: fx.admin.id, roleId: role.id })
  await AdminPermission.create({ userId: fx.accessAdmin.id, permissionId: accessManage.id })

  fx.organizationId = (
    await call(fx.owner, 'post', '/dashboard/organizations').send({ name: `Review Co ${Date.now()}` })
  ).body.data.id
  fx.projectId = (
    await call(fx.owner, 'post', `/dashboard/organizations/${fx.organizationId}/projects`).send({ name: 'Review App' })
  ).body.data.id
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)

  for (const account of [fx.owner, fx.admin, fx.accessAdmin]) if (account.id) await User.destroy(account.id)
})

describe('admin review notifications', () => {
  it('notifies and emails organization admins when a business verification is submitted', async () => {
    const form = new FormData()
    const fields = {
      legal_name: 'Review Co Limited',
      country: 'NG',
      registration_number: 'RC654321',
      registered_address: '2 Test Street, Lagos',
      website: 'https://review.example.com',
      dpo_name: 'Data Officer',
      dpo_email: 'dpo@review.example.com',
      privacy_policy_url: 'https://review.example.com/privacy',
    }

    for (const [key, value] of Object.entries(fields)) form.append(key, value)
    form.append('incorporation_document', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'cac.pdf')

    const res = await call(fx.owner, 'post', `/dashboard/organizations/${fx.organizationId}/verification`).send(form)

    expect(res.status).toBe(201)

    const [notice] = await notificationsOf(fx.admin, NOTIFICATION_TYPE.businessVerificationSubmitted)

    expect(notice.action_link).toBe(`/admin/business-verifications/${res.body.data.id}`)
    expect(await mailsTo(fx.admin.email, 'Business verification awaiting review')).toBe(1)

    expect(await notificationsOf(fx.accessAdmin, NOTIFICATION_TYPE.businessVerificationSubmitted)).toHaveLength(0)
    expect(await notificationsOf(fx.owner, NOTIFICATION_TYPE.businessVerificationSubmitted)).toHaveLength(0)
  })

  it('notifies and emails extended access admins when a project requests access', async () => {
    const res = await call(
      fx.owner,
      'post',
      `/dashboard/organizations/${fx.organizationId}/projects/${fx.projectId}/extended-access/request`,
    ).send({ capabilities: ['ai'] })

    expect(res.status).toBe(200)

    for (const admin of [fx.admin, fx.accessAdmin]) {
      const [notice] = await notificationsOf(admin, NOTIFICATION_TYPE.extendedAccessRequested)

      expect(notice.action_link).toBe(`/admin/extended-access/${fx.projectId}`)
      expect(await mailsTo(admin.email, 'Extended access awaiting review')).toBe(1)
    }

    expect(await notificationsOf(fx.owner, NOTIFICATION_TYPE.extendedAccessRequested)).toHaveLength(0)
  })
})
