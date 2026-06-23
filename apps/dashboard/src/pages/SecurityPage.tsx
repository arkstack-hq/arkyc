import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Auth, errorMessage } from '@/lib/api'
import type { TwoFactorMethod, TwoFactorStatus } from '@/lib/api'
import { Copy, KeyRound, Lock, Mail, ShieldCheck, Smartphone } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm, useRequest } from 'alova/client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Loading, PageHeader } from '@/components/States'
import { renderQrSvg } from '@/lib/qr'

interface SetupPayload {
  two_factor: { method: TwoFactorMethod; secret?: string; otpauth_url?: string }
}
interface ConfirmPayload {
  two_factor: { recovery_codes: string[] }
}

type Enroll = { method: TwoFactorMethod; secret?: string; otpauthUrl?: string }

export default function SecurityPage() {
  const {
    data: status,
    loading,
    send: refreshStatus,
  } = useRequest(Auth.twoFactorStatus(), {
    initialData: { enabled: false, method: null, recovery_codes_remaining: 0, enabled_at: null } as TwoFactorStatus,
  })

  // In-progress enrollment and the one-time recovery codes shown after confirming.
  const [enroll, setEnroll] = useState<Enroll | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  const reset = useCallback(() => {
    setEnroll(null)
    setRecoveryCodes(null)
    void refreshStatus()
  }, [refreshStatus])

  return (
    <div className="mx-auto w-full max-w-2xl p-6 lg:p-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>
      <PageHeader title="Security" description="Protect your account with two-factor authentication." />

      {loading ? (
        <Loading />
      ) : recoveryCodes ? (
        <RecoveryCodes codes={recoveryCodes} onDone={reset} />
      ) : enroll ? (
        <ConfirmEnrollment enroll={enroll} onConfirmed={setRecoveryCodes} onCancel={() => setEnroll(null)} />
      ) : status.enabled ? (
        <EnabledCard status={status} onDisabled={reset} />
      ) : (
        <ChooseMethod onStarted={setEnroll} />
      )}
    </div>
  )
}

/** 2FA is on: show the active method and let the user turn it off. */
function EnabledCard({ status, onDisabled }: { status: TwoFactorStatus; onDisabled: () => void }) {
  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData: { password: string }) => Auth.disableTwoFactor({ password: formData.password }),
    { initialForm: { password: '' } },
  )
  onSuccess(onDisabled)

  const label = status.method === 'email' ? 'Email codes' : 'Authenticator app'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-success" />
            Two-factor authentication
          </CardTitle>
          <Badge variant="secondary" className="bg-success/10 text-success">
            On
          </Badge>
        </div>
        <CardDescription>
          Active method: <span className="font-medium text-foreground">{label}</span> ·{' '}
          {status.recovery_codes_remaining} recovery code{status.recovery_codes_remaining === 1 ? '' : 's'} left.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          void send()
        }}
      >
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Confirm your password to disable two-factor authentication.</p>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Lock />
              </InputGroupAddon>
              <InputGroupInput
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                aria-invalid={!!error?.flat?.password}
                onChange={(e) => {
                  updateForm({ password: e.target.value })
                  if (error?.errors) error.delete('password', update)
                }}
              />
            </InputGroup>
            <FieldError errors={error?.list?.password} />
          </Field>
          {error && !error.errors ? <FieldError>{errorMessage(error)}</FieldError> : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="destructive" disabled={loading}>
            {loading ? 'Disabling…' : 'Disable two-factor'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

/** 2FA is off: pick a method to enroll. */
function ChooseMethod({ onStarted }: { onStarted: (enroll: Enroll) => void }) {
  const { loading, send: runSetup } = useRequest((method: TwoFactorMethod) => Auth.setupTwoFactor({ method }), {
    immediate: false,
  })
  const [pending, setPending] = useState<TwoFactorMethod | null>(null)

  const start = useCallback(
    async (method: TwoFactorMethod) => {
      setPending(method)
      try {
        const res = (await runSetup(method)) as SetupPayload
        onStarted({ method, secret: res.two_factor.secret, otpauthUrl: res.two_factor.otpauth_url })
      } catch {
        setPending(null)
      }
    },
    [runSetup, onStarted],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          Add a second step to your sign-in. Choose how you&apos;d like to receive your codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MethodOption
          icon={<Smartphone className="size-5" />}
          title="Authenticator app"
          description="Use Google Authenticator, 1Password, or any TOTP app."
          busy={loading && pending === 'authenticator'}
          disabled={loading}
          onClick={() => void start('authenticator')}
        />
        <MethodOption
          icon={<Mail className="size-5" />}
          title="Email codes"
          description="We'll email a one-time code each time you sign in."
          busy={loading && pending === 'email'}
          disabled={loading}
          onClick={() => void start('email')}
        />
      </CardContent>
    </Card>
  )
}

function MethodOption({
  icon,
  title,
  description,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent/40 disabled:opacity-60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </span>
      <span className="flex flex-1 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <span className="text-sm text-primary">{busy ? 'Starting…' : 'Set up'}</span>
    </button>
  )
}

/** Step two of enrollment: confirm the code for the chosen method. */
function ConfirmEnrollment({
  enroll,
  onConfirmed,
  onCancel,
}: {
  enroll: Enroll
  onConfirmed: (codes: string[]) => void
  onCancel: () => void
}) {
  const isAuth = enroll.method === 'authenticator'
  const qr = useMemo(() => (enroll.otpauthUrl ? renderQrSvg(enroll.otpauthUrl) : null), [enroll.otpauthUrl])

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData: { code: string }) => Auth.confirmTwoFactor({ method: enroll.method, code: formData.code.trim() }),
    { initialForm: { code: '' } },
  )
  onSuccess(({ data }) => onConfirmed((data as ConfirmPayload).two_factor.recovery_codes))

  // Re-sending the email setup code is just re-running setup (idempotent within the TTL).
  const { loading: resending, send: resend } = useRequest(() => Auth.setupTwoFactor({ method: 'email' }), {
    immediate: false,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isAuth ? 'Scan the QR code' : 'Check your email'}</CardTitle>
        <CardDescription>
          {isAuth
            ? 'Scan this with your authenticator app, then enter the 6-digit code it shows.'
            : 'Enter the 6-digit code we just emailed you to finish enabling email codes.'}
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          void send()
        }}
      >
        <CardContent className="flex flex-col gap-4">
          {isAuth && qr ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-44 rounded-lg border border-border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              {enroll.secret ? (
                <p className="text-center text-xs text-muted-foreground">
                  Can&apos;t scan? Enter this key manually:
                  <br />
                  <code className="mt-1 inline-block rounded bg-muted px-2 py-1 font-mono text-foreground">
                    {enroll.secret}
                  </code>
                </p>
              ) : null}
            </div>
          ) : null}

          <Field>
            <FieldLabel htmlFor="code">Verification code</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <ShieldCheck />
              </InputGroupAddon>
              <InputGroupInput
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                placeholder="6-digit code"
                value={form.code}
                aria-invalid={!!error?.flat?.code}
                onChange={(e) => {
                  updateForm({ code: e.target.value })
                  if (error?.errors) error.delete('code', update)
                }}
              />
            </InputGroup>
            <FieldError errors={error?.list?.code} />
          </Field>
          {error && !error.errors ? <FieldError>{errorMessage(error)}</FieldError> : null}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {!isAuth ? (
              <Button type="button" variant="outline" disabled={resending} onClick={() => void resend()}>
                {resending ? 'Sending…' : 'Resend'}
              </Button>
            ) : null}
            <Button type="submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Enable'}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

/** Final step: show the one-time recovery codes. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(codes.join('\n')).then(() => setCopied(true))
  }, [codes])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          Save your recovery codes
        </CardTitle>
        <CardDescription>
          Each code works once if you lose access to your second factor. Store them somewhere safe — you won&apos;t see
          them again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm">
          {codes.map((code) => (
            <span key={code} className="text-center tracking-widest">
              {code}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          <Copy className="size-4" />
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </CardFooter>
    </Card>
  )
}
