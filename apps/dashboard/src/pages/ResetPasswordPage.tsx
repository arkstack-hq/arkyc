import { Auth, errorMessage } from '@/lib/api'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { KeyRound, Lock } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import { useForm } from 'alova/client'
import { useState } from 'react'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [mismatch, setMismatch] = useState(false)

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData) => Auth.resetPassword(formData.token.trim(), { password: formData.password }),
    {
      initialForm: {
        token: params.get('token') ?? '',
        password: '',
        confirm: '',
      },
    },
  )

  onSuccess(() => navigate('/login', { replace: true }))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    void send()
  }

  return (
    <AuthShell
      title="Set a new password"
      description="Enter the code we emailed you and choose a new password."
      footer={
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              value={form.token}
              aria-invalid={!!error?.flat?.token}
              onChange={(e) => {
                updateForm({ token: e.target.value })
                if (error?.errors) error.delete('token', update)
              }}
            />
          </InputGroup>
          <FieldError errors={error?.list?.token} />
        </Field>

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
