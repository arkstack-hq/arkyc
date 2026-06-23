import { Auth, errorMessage } from '@/lib/api'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { KeyRound, Loader2, Lock } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import { useForm, useRequest } from 'alova/client'
import { useRateLimit } from '@/hooks/useRateLimit'

type Phase = 'verifying' | 'code' | 'reset'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  // ForgotPasswordPage forwards the email so resend works without re-asking for it.
  const email = (location.state as { email?: string } | null)?.email ?? ''

  const initialToken = params.get('token') ?? ''
  const [token, setToken] = useState(initialToken)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(initialToken ? 'verifying' : 'code')
  const [mismatch, setMismatch] = useState(false)
  const [resent, setResent] = useState(false)

  // Step 1 — confirm the reset code is valid before revealing the password fields.
  const { loading: verifying, send: verifyToken } = useRequest((tok: string) => Auth.verifyResetToken(tok), {
    immediate: false,
  })

  const checkToken = useCallback(
    async (raw: string) => {
      const value = raw.trim()
      if (!value) return
      setTokenError(null)
      try {
        await verifyToken(value)
        setToken(value)
        setPhase('reset')
      } catch (err) {
        setTokenError(errorMessage(err, 'Invalid or expired reset code.'))
        setPhase('code')
      }
    },
    [verifyToken],
  )

  // Auto-verify a code that arrived through the emailed link.
  const autoChecked = useRef(false)
  useEffect(() => {
    if (autoChecked.current || !initialToken) return
    autoChecked.current = true
    void checkToken(initialToken)
  }, [initialToken, checkToken])

  // Step 2 — set the new password (only reachable once the code is verified).
  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData) => Auth.resetPassword(token, { password: formData.password }),
    { initialForm: { password: '', confirm: '' } },
  )
  onSuccess(() => navigate('/login', { replace: true }))

  // Resend, throttled by the server's rate limit (persisted by alova on 429).
  const { seconds: cooldown, refresh: refreshCooldown } = useRateLimit('POST', '/v1/auth/forgot')
  const { loading: resending, send: resend } = useRequest((addr: string) => Auth.forgotPassword({ email: addr }), {
    immediate: false,
  })

  const onResend = useCallback(async () => {
    if (!email || cooldown > 0 || resending) return
    setResent(false)
    try {
      await resend(email)
      setResent(true)
    } catch {
      // A 429 (or any error) is reflected by the cooldown read below.
    } finally {
      await refreshCooldown()
    }
  }, [email, cooldown, resending, resend, refreshCooldown])

  function onVerifySubmit(e: FormEvent) {
    e.preventDefault()
    void checkToken(token)
  }

  function onResetSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    void send()
  }

  const resendControl = email ? (
    <button
      type="button"
      className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
      disabled={cooldown > 0 || resending}
      onClick={() => void onResend()}
    >
      {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
    </button>
  ) : (
    <Link to="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
      Request a new code
    </Link>
  )

  // While auto-verifying the emailed link, show a quiet loading state.
  if (phase === 'verifying') {
    return (
      <AuthShell
        title="Verifying your link"
        description="Checking your reset code…"
        footer={
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          One moment…
        </div>
      </AuthShell>
    )
  }

  // Step 1 — enter / confirm the reset code.
  if (phase === 'code') {
    return (
      <AuthShell
        title="Enter your reset code"
        description="Enter the 6-digit code we emailed you to continue."
        footer={
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <form onSubmit={onVerifySubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="token">Reset code</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <KeyRound />
              </InputGroupAddon>
              <InputGroupInput
                id="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="6-digit code"
                value={token}
                aria-invalid={!!tokenError}
                onChange={(e) => {
                  setToken(e.target.value)
                  if (tokenError) setTokenError(null)
                }}
              />
            </InputGroup>
            {tokenError ? <FieldError>{tokenError}</FieldError> : null}
          </Field>

          <Button type="submit" className="mt-2 w-full" disabled={verifying || !token.trim()}>
            {verifying ? 'Verifying…' : 'Continue'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {resent ? 'A new code is on its way. ' : "Didn't get a code? "}
            {resendControl}
          </p>
        </form>
      </AuthShell>
    )
  }

  // Step 2 — choose a new password.
  return (
    <AuthShell
      title="Set a new password"
      description="Your code checked out. Choose a new password to finish."
      footer={
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onResetSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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

        <Field>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirm}
              aria-invalid={mismatch}
              onChange={(e) => {
                updateForm({ confirm: e.target.value })
                setMismatch(false)
              }}
            />
          </InputGroup>
          {mismatch ? <FieldError>Passwords do not match.</FieldError> : null}
        </Field>

        {error && !error.errors ? <FieldError>{errorMessage(error)}</FieldError> : null}

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  )
}
