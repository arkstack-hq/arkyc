import { User as BaseUser } from '@arkstack/auth'
import { PersonalAccessToken } from './PersonalAccessToken'
import { UserNotification } from './UserNotification'
import { UserTwoFactor } from './UserTwoFactor'
import { UserFactory } from 'src/database/factories/UserFactory'
import { ProjectMember } from './ProjectMember'
import { UserPermission } from './UserPermission'
import { AdminPermission } from './AdminPermission'
import { Review } from './Review'
import { Tenant } from './Tenant'

export class User extends BaseUser {
  declare email: string
  declare phone?: string
  declare password: string
  declare firstName: string
  declare lastName?: string
  declare avatarUrl: string | null
  declare lastLoginAt: Date | null
  declare emailVerifiedAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override factoryClass = UserFactory

  protected override appends = ['name']

  protected static override columns = {
    avatarUrl: 'avatar_url',
    lastLoginAt: 'last_login_at',
    emailVerifiedAt: 'email_verified_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override hidden = ['password']

  personalAccessTokens() {
    return this.hasMany(PersonalAccessToken, 'userId')
  }

  twoFactor() {
    return this.hasOne(UserTwoFactor, 'userId')
  }

  notifications() {
    return this.hasMany(UserNotification, 'userId')
  }

  tenantMemberships() {
    return this.belongsToMany(Tenant, 'tenant_members', 'tenantId', 'userId')
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
