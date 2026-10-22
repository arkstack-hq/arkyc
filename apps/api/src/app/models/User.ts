import { User as BaseUser } from '@arkstack/auth'
import { PersonalAccessToken } from './PersonalAccessToken'
import { UserNotification } from './UserNotification'
import { UserTwoFactor } from './UserTwoFactor'
import { UserFactory } from 'src/database/factories/UserFactory'
import { ProjectMember } from './ProjectMember'
import { UserPermission } from './UserPermission'
import { AdminPermission } from './AdminPermission'
import { Review } from './Review'
import { Organization } from './Organization'
import { OrganizationMember } from './OrganizationMember'
import { UserPushToken } from './UserPushToken'
import type { NotificationPreferences } from '@arkyc/types'
import type { CastMap } from 'arkormx'

/** Account standing. `null` is treated as `active`. */
export type UserStatus = 'active' | 'restricted' | 'suspended'

export class User extends BaseUser {
  declare email: string
  declare phone?: string
  declare password: string
  declare firstName: string
  declare lastName?: string
  declare avatarUrl: string | null
  declare lastLoginAt: Date | null
  declare emailVerifiedAt: Date | null
  /** `active` (default/null), `restricted` (read-only), or `suspended` (no login). */
  declare status: UserStatus | null
  /** Overrides of the default notification preferences; null means defaults. */
  declare notificationPreferences: Partial<NotificationPreferences> | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override factoryClass = UserFactory

  protected override appends = ['name']

  protected static override columns = {
    avatarUrl: 'avatar_url',
    lastLoginAt: 'last_login_at',
    emailVerifiedAt: 'email_verified_at',
    notificationPreferences: 'notification_preferences',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override hidden = ['password']

  protected override casts: CastMap = {
    notificationPreferences: 'json',
  }

  personalAccessTokens() {
    return this.hasMany(PersonalAccessToken, 'userId')
  }

  twoFactor() {
    return this.hasOne(UserTwoFactor, 'userId')
  }

  notifications() {
    return this.hasMany(UserNotification, 'userId')
  }

  organizationMembers() {
    return this.hasMany(OrganizationMember, 'userId')
  }

  pushTokens() {
    return this.hasMany(UserPushToken, 'userId')
  }

  organizationMemberships() {
    return this.belongsToMany(Organization, 'organization_members', 'organizationId', 'userId')
  }

  projectMemberships() {
    return this.hasMany(ProjectMember, 'userId')
  }

  directPermissions() {
    return this.hasMany(UserPermission, 'userId')
  }

  /** Platform-admin grants (roles and/or direct admin permissions). */
  adminPermissions() {
    return this.hasMany(AdminPermission, 'userId')
  }

  reviews() {
    return this.hasMany(Review, 'reviewerId')
  }

  getNameAttribute(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }

  setNameAttribute(name: string): void {
    const [firstName, lastName] = name.split(' ')

    this.firstName = firstName
    this.lastName = lastName
  }
}
