import { Auth, errorMessage } from '@/lib/api'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useRequest } from 'alova/client'

export default function VerifyEmailPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Send a code on mount (and let the user resend), then confirm it.
  const { loading: sending, send: sendCode } = useRequest(Auth.sendEmailVerification(), { immediate: false })

  // Send a code exactly once when the page opens.
  const sentOnce = useRef(false)
  useEffect(() => {
    if (sentOnce.current) return
    sentOnce.current = true
    void sendCode()
  }, [sendCode])

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(Auth.confirmEmailVerification, {
    initialForm: { code: '' },
  })

  onSuccess(() => navigate('/', { replace: true }))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  return (
    <AuthShell
      title="Verify your email"
      description={`We sent a 6-digit code to ${user?.email ?? 'your email'}. Enter it below to continue.`}
      footer={
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
          disabled={sending}
          onClick={() => void sendCode()}
        >
          {sending ? 'Sending…' : 'Resend code'}
        </button>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="code">Verification code</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <KeyRound />
            </InputGroupAddon>
            <InputGroupInput
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
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
          {loading ? 'Verifying…' : 'Verify email'}
        </Button>

        <button
          type="button"
          className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => navigate('/', { replace: true })}
        >
          Skip for now
        </button>
      </form>
    </AuthShell>
  )
}
