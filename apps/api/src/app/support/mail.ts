import { Logger } from '@arkstack/common'
import { Notification } from '@arkstack/notifications'

/**
 * Send a transactional email without blocking the response. Delivery failures
 * are logged, never thrown — the caller's flow (e.g. issuing a reset code) must
 * not depend on the mail transport being reachable.
 *
 * @param recipient The destination email address.
 * @param message   The message body/template.
 * @param subject   The email subject.
 * @param data      Template variables to interpolate.
 * @returns         Nothing; the send runs in the background.
 */
export function sendMail(
  recipient: string,
  message: string,
  subject: string,
  data: Record<string, unknown>,
): void {
  void Notification.email()
    .recipient(recipient)
    .send(message, subject, undefined, data)
    .catch((error: unknown) => {
      Logger.error('Mail delivery failed: ' + (error as Error).message)
    })
}
