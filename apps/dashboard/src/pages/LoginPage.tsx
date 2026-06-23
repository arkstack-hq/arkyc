import { Auth, errorMessage } from '@/lib/api'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useState } from 'react'

import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import type { TwoFactorChallenge } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { useForm, useRequest } from 'alova/client'
import { useRateLimit } from '@/hooks/useRateLimit'

export default function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null)

  const enter = useCallback(
    (user: Parameters<typeof setUser>[0]) => {
      setUser(user)
      navigate('/')
    },
    [setUser, navigate],
  )

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(Auth.login, {
    initialForm: { email: '', password: '' },
  })

  // 2FA accounts get a challenge (and no token) instead of a session.
  onSuccess(({ data }) => {
    if (data.twoFactor?.required) setChallenge(data.twoFactor)
    else enter(data.user)
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  if (challenge) {
    return <TwoFactorStep challenge={challenge} email={form.email} onCancel={() => setChallenge(null)} onDone={enter} />
  }

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back. Sign in to your account."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Mail />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              aria-invalid={!!error?.flat?.email}
              onChange={(e) => {
                updateForm({ email: e.target.value })
                if (error?.errors) error.delete('email', update)
              }}
            />
          </InputGroup>
          <FieldError errors={error?.list?.email} />
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
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
        </Field>

        {error && !error.errors ? <FieldError>{errorMessage(error)}</FieldError> : null}

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}

/** The second step of a 2FA login: enter a TOTP / emailed / recovery code. */
function TwoFactorStep({
  challenge,
  email,
  onCancel,
  onDone,
}: {
  challenge: TwoFactorChallenge
  email: string
  onCancel: () => void
  onDone: (user: Parameters<ReturnType<typeof useAuth>['setUser']>[0]) => void
}) {
  const isEmail = challenge.method === 'email'

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData: { code: string }) => Auth.loginTwoFactor({ ticket: challenge.ticket, code: formData.code.trim() }),
    { initialForm: { code: '' } },
  )
  onSuccess(({ data }) => onDone(data.user))

  // Resend (email only), throttled by the server's 429 cooldown.
  const { seconds: cooldown, refresh: refreshCooldown } = useRateLimit('POST', '/v1/auth/login/2fa/resend')
  const { loading: resending, send: resend } = useRequest(() => Auth.resendLoginCode({ ticket: challenge.ticket }), {
    immediate: false,
  })
  const onResend = useCallback(async () => {
    if (cooldown > 0 || resending) return
    try {
      await resend()
    } catch {
      // surfaced via the cooldown read below
    } finally {
      await refreshCooldown()
    }
  }, [cooldown, resending, resend, refreshCooldown])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  return (
    <AuthShell
      title="Two-factor authentication"
      description={
        isEmail
          ? `Enter the 6-digit code we emailed to ${email || 'your email'}.`
          : 'Enter the 6-digit code from your authenticator app.'
      }
      footer={
        <button
          type="button"
          onClick={onCancel}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </button>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="code">Verification code</FieldLabel>
          <InputGroup>
            <InputGroupAddon>{isEmail ? <Mail /> : <ShieldCheck />}</InputGroupAddon>
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

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>

        <p className="flex items-center justify-center gap-1 text-center text-sm text-muted-foreground">
          <KeyRound className="size-3.5" />
          You can also enter a recovery code.
        </p>

        {isEmail ? (
          <button
            type="button"
            className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
            disabled={cooldown > 0 || resending}
            onClick={() => void onResend()}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
          </button>
        ) : null}
      </form>
    </AuthShell>
  )
}
