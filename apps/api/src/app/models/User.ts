import { User as BaseUser } from '@arkstack/auth'
import { PersonalAccessToken } from './PersonalAccessToken'
import { UserNotification } from './UserNotification'
import { UserTwoFactor } from './UserTwoFactor'
import { UserFactory } from 'src/database/factories/UserFactory'
import { TenantMember } from './TenantMember'
import { ProjectMember } from './ProjectMember'
import { UserPermission } from './UserPermission'
import { Review } from './Review'

export class User extends BaseUser {
    declare email: string
    declare password: string
    declare name: string
    declare avatarUrl: string | null
    declare lastLoginAt: Date | null
    declare emailVerifiedAt: Date | null
    declare createdAt: Date
    declare updatedAt: Date

    protected static override factoryClass = UserFactory

    protected static override columns = {
        avatarUrl: 'avatar_url',
        lastLoginAt: 'last_login_at',
        emailVerifiedAt: 'email_verified_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    protected override hidden = [
        'password'
    ]

    personalAccessTokens () {
        return this.hasMany(PersonalAccessToken, 'userId')
    }

    twoFactor () {
        return this.hasOne(UserTwoFactor, 'userId')
    }

    notifications () {
        return this.hasMany(UserNotification, 'userId')
    }

    tenantMemberships () {
        return this.hasMany(TenantMember, 'userId')
    }

    projectMemberships () {
        return this.hasMany(ProjectMember, 'userId')
    }

    directPermissions () {
        return this.hasMany(UserPermission, 'userId')
    }

    reviews () {
        return this.hasMany(Review, 'reviewerId')
    }
}
