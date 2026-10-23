import { Model } from 'arkormx'
import { timingSafeEqual } from 'node:crypto'

export class PasswordReset extends Model {
  declare id: string
  declare email: string | null
  declare phone: string | null
  declare token: string
  declare attempts: number
  declare createdAt: Date
  declare updatedAt: Date

  static readonly MAX_ATTEMPTS = 5

  /**
   * Splits a submitted token into its code and email.
   *
   * A six-digit code needs the email it was sent to; a link token carries both.
   *
   * @param token
   * @param email
   * @returns
   */
  static parse(token: string, email?: string | null): { code: string; email: string | null } {
    if (token.length <= 6) return { code: token, email: email ?? null }

    const decoded = Buffer.from(token, 'base64url').toString()
    const separator = decoded.indexOf('-')

    return separator > 0
      ? { code: decoded.slice(0, separator), email: decoded.slice(separator + 1) }
      : { code: '', email: null }
  }

  /**
   * The open reset for `email` whose code is `code`.
   *
   * Every check spends one attempt before comparing, and a reset is discarded
   * once its attempts run out.
   *
   * @param email
   * @param code
   * @returns
   */
  static async redeem(email: string, code: string): Promise<PasswordReset | null> {
    const reset = await this.query().where({ email }).latest().first()

    if (!reset) return null

    if (reset.attempts >= this.MAX_ATTEMPTS) {
      await reset.delete()

      return null
    }

    const spent = await this.query()
      .where({ id: reset.id, attempts: reset.attempts })
      .updateFrom({ attempts: reset.attempts + 1 })

    return spent > 0 && reset.matches(code) ? reset : null
  }

  matches(code: string): boolean {
    const expected = Buffer.from(this.token)
    const actual = Buffer.from(code)

    return expected.length === actual.length && timingSafeEqual(expected, actual)
  }

  /**
   * get the password reset link
   */
  link() {
    const token = Buffer.from(`${this.token}-${this.email}`).toString('base64url')

    return `${config('app.frontend_url')}/auth/reset-password?token=${token}`
  }
}
