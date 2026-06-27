import { Command } from '@h3ravel/musket'
import { Notification } from '@arkstack/notifications'

/**
 * `ark mail:test <email> [--subject=…]` — send a test email to verify SMTP
 * delivery. Unlike the app's fire-and-forget {@link sendMail} (which logs and
 * swallows transport failures), this awaits the send and surfaces any error, so
 * MAIL_HOST / MAIL_PORT / MAIL_USERNAME / MAIL_PASSWORD / MAIL_FROM_ADDRESS can
 * be confirmed end-to-end against the configured mailer.
 */
export class MailTestCommand extends Command {
  signature = `mail:test
        {email : The recipient address to send the test email to}
        {--subject? : Subject line (defaults to "<App name> SMTP test")}
    `

  description = 'Send a test email to verify SMTP delivery'

  async handle() {
    const recipient = String(this.argument('email') ?? '').trim()

    if (!recipient.includes('@')) {
      this.error('Provide a valid recipient address, e.g. `ark mail:test you@example.com`.')

      return
    }

    const appName = config('app.name', 'Arkyc')
    const subject = String(this.option('subject') || `${appName} SMTP test`)
    const host = config('notifications.transports.smtp.host', 'localhost')
    const port = config('notifications.transports.smtp.port', 1025)

    this.info(`Sending test email to ${recipient} via ${host}:${port} …`)

    // Bound the send so a wrong host/port/TLS setting fails fast instead of
    // hanging on a stuck SMTP handshake.
    const TIMEOUT_MS = 20_000
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
      const send = Notification.email()
        .recipient(recipient)
        .send('email/template', subject, undefined, {
          subject,
          message: `This is a test email from ${appName}. If you can read this, your SMTP delivery is working.`,
          app_name: appName,
          year: new Date().getFullYear(),
        })

      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `No response within ${TIMEOUT_MS / 1000}s — check MAIL_HOST/MAIL_PORT and MAIL_SECURE ` +
                `(port 587 usually needs MAIL_SECURE=false for STARTTLS; use port 465 with MAIL_SECURE=true).`,
              ),
            ),
          TIMEOUT_MS,
        )
      })

      await Promise.race([send, timeout])

      this.success(`Test email sent to ${recipient}. Check the inbox (and spam folder).`)
    } catch (error) {
      this.error(`SMTP send failed: ${(error as Error).message}`)
      process.exitCode = 1
    } finally {
      clearTimeout(timer)
    }
  }
}
