import { Hash } from '@arkstack/common'
import { TwoFactor } from '@arkstack/auth'

import { User } from '@app/models/User'
import { UserTwoFactor } from '@app/models/UserTwoFactor'
import { sendMail } from '@app/support/mail'

/** The two opt-in second factors Arkyc supports. */
export type TwoFactorMethod = 'authenticator' | 'email'

/** Public, client-safe view of a user's 2FA state. */
export interface TwoFactorStatus {
  enabled: boolean
  method: TwoFactorMethod | null
  recovery_codes_remaining: number
  enabled_at: string | null
}

/** Lifetime of an emailed 2FA code, in seconds (matches the authenticator UX of ~10 min). */
const EMAIL_CODE_TTL = 60 * 10

/**
 * Two-factor authentication built on the framework's `TwoFactor` helper.
 *
 * Authenticator (TOTP) enrollment, recovery codes, secret encryption, and the
 * `enabled_at` timestamp are delegated to `@arkstack/auth`. The email channel is
 * layered on with the same stateless `Hash.otp` codes the rest of Arkyc uses for
 * verification and password reset, so it needs no extra storage. Each user has a
 * single active method; both methods are opt-in and off by default.
 */
export class TwoFactorService {
  /**
   * The user's 2FA record, if any has ever been created.
   *
   * @param userId
   * @returns
   */
  private static record(userId: User['id']) {
    return UserTwoFactor.query().where({ userId }).first()
  }

  /** The user's currently selected method (may be pending confirmation). */
  static async getMethod(userId: User['id']): Promise<TwoFactorMethod | null> {
    const record = await this.record(userId)

    return (record?.method as TwoFactorMethod | null) ?? null
  }

  /**
   * Persist the selected method without enabling
   * it (enrollment is a two-step flow).
   *
   * @param userId
   * @param method
   */
  private static async setMethod(userId: User['id'], method: TwoFactorMethod): Promise<void> {
    await UserTwoFactor.query().updateOrInsert({ userId }, { method })
  }

  /**
   * Read recovery-code hashes, tolerating either a parsed array (jsonb) or a raw
   * JSON string depending on the adapter.
   *
   * @param userId
   * @returns
   */
  private static async recoveryHashes(userId: User['id']): Promise<string[]> {
    const raw = (await this.record(userId))?.recoveryCodeHashes as string[] | string | null | undefined
    if (!raw) return []

    return Array.isArray(raw) ? raw : (JSON.parse(raw) as string[])
  }

  /**
   * Persist recovery-code hashes as a serialized JSON string. The query builder
   * does not apply the model's `json` cast, so an array would reach the `jsonb`
   * column unserialized — stringify here to keep it valid JSON.
   *
   * @param userId
   * @param hashes
   */
  private static async writeRecoveryHashes(userId: User['id'], hashes: string[]): Promise<void> {
    await UserTwoFactor.query().updateOrInsert({ userId }, { recoveryCodeHashes: JSON.stringify(hashes) })
  }

  /**
   * Whether 2FA is fully enabled (a method is chosen and confirmed).
   *
   * @param userId
   * @returns
   */
  static async isEnabled(userId: User['id']): Promise<boolean> {
    const record = await this.record(userId)

    return !!record?.enabledAt && !!record?.method
  }

  /**
   * The public 2FA status payload for the account settings screen.
   *
   * @param userId
   * @returns
   */
  static async status(userId: User['id']): Promise<TwoFactorStatus> {
    const record = await this.record(userId)
    const method = (record?.method as TwoFactorMethod | null) ?? null
    const enabled = !!record?.enabledAt && !!method

    return {
      enabled,
      method: enabled ? method : null,
      recovery_codes_remaining: enabled ? (await this.recoveryHashes(userId)).length : 0,
      enabled_at: enabled ? (record?.enabledAt?.toISOString() ?? null) : null,
    }
  }

  /**
   * Stable per-user OTP key, namespaced by purpose so a setup
   * code can't pass at login.
   *
   * @param user
   * @param purpose
   * @returns
   */
  private static emailKey(user: User, purpose: 'setup' | 'login'): string {
    return `${user.email}:2fa:${purpose}`
  }

  private static verifyEmailCode(user: User, code: string, purpose: 'setup' | 'login'): boolean {
    return Hash.otp(6, this.emailKey(user, purpose), EMAIL_CODE_TTL).validate({ token: code }) !== null
  }

  /**
   * Generate and email a fresh code for the given purpose.
   * Resends are idempotent within the TTL.
   *
   * @param user
   * @param purpose
   */
  static sendEmailCode(user: User, purpose: 'setup' | 'login'): void {
    const code = Hash.otp(6, this.emailKey(user, purpose), EMAIL_CODE_TTL).generate()
    const msg = config(`messages.two_factor.email.${purpose}`)
    sendMail(user.email, msg.template, msg.subject, {
      code,
      name: user.name,
      app_name: config('app.name'),
    })
  }

  /**
   * Begin authenticator enrollment: stash a pending secret and
   * return it for the QR/manual entry.
   *
   * @param user
   * @returns
   */
  static async setupAuthenticator(user: User): Promise<{ secret: string; otpauthUrl: string }> {
    const setup = TwoFactor.createSetup(user)
    await TwoFactor.setSecret(user.id, setup.secret)
    await this.setMethod(user.id, 'authenticator')

    return setup
  }

  /**
   * Begin email enrollment: mark the pending method and email a setup code.
   *
   * @param user
   */
  static async setupEmail(user: User): Promise<void> {
    await this.setMethod(user.id, 'email')
    this.sendEmailCode(user, 'setup')
  }

  /**
   * Verify the enrollment code for `method`;
   * on success the caller enables and returns recovery codes.
   *
   * @param user
   * @param method
   * @param code
   * @returns
   */
  static async verifySetup(user: User, method: TwoFactorMethod, code: string): Promise<boolean> {
    if (method === 'authenticator') {
      const secret = await TwoFactor.getSecret(user.id)

      return !!secret && TwoFactor.verifyCode(user, secret, code)
    }

    return this.verifyEmailCode(user, code, 'setup')
  }

  /**
   * Confirm and enable 2FA for `method`, issuing one-time
   * recovery codes (shown once).
   *
   * @param user
   * @param method
   * @returns
   */
  static async enable(user: User, method: TwoFactorMethod): Promise<string[]> {
    const recoveryCodes = TwoFactor.generateBackupCodes()
    const hashes = await TwoFactor.hashBackupCodes(recoveryCodes)
    await UserTwoFactor.query().updateOrInsert(
      { userId: user.id },
      { method, enabledAt: new Date(), recoveryCodeHashes: JSON.stringify(hashes) },
    )

    return recoveryCodes
  }

  /**
   * Tear down all 2FA state for the user.
   *
   * @param userId
   */
  static async disable(userId: User['id']): Promise<void> {
    await TwoFactor.clear(userId)
  }

  /**
   * Send the login code for an email-method user (no-op for authenticator).
   *
   * @param user
   */
  static async sendLoginChallenge(user: User): Promise<void> {
    if ((await this.getMethod(user.id)) === 'email') this.sendEmailCode(user, 'login')
  }

  /**
   * Verify a code submitted at login against the user's
   * active method, falling  back to a one-time recovery
   * code (which is consumed on success).
   *
   * @param user
   * @param code
   * @returns
   */
  static async verifyChallenge(user: User, code: string): Promise<boolean> {
    const method = await this.getMethod(user.id)
    if (method === 'authenticator') {
      const secret = await TwoFactor.getSecret(user.id)
      if (secret && TwoFactor.verifyCode(user, secret, code)) return true
    } else if (method === 'email') {
      if (this.verifyEmailCode(user, code, 'login')) return true
    }

    return this.consumeRecoveryCode(user.id, code)
  }

  /**
   * Consume a one-time recovery code, removing it on a successful match.
   *
   * @param userId
   * @param code
   * @returns
   */
  private static async consumeRecoveryCode(userId: User['id'], code: string): Promise<boolean> {
    const hashes = await this.recoveryHashes(userId)
    for (let i = 0; i < hashes.length; i++) {
      if (await Hash.verify(code, hashes[i])) {
        hashes.splice(i, 1)
        await this.writeRecoveryHashes(userId, hashes)

        return true
      }
    }

    return false
  }
}
