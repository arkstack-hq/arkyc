import { Auth, errorMessage } from '@/lib/api'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { CheckCircle2, Mail } from 'lucide-react'

import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'alova/client'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(Auth.forgotPassword, {
    initialForm: { email: '' },
  })

  onSuccess(() => setSent(true))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        description={`If an account exists for ${form.email}, we've sent a reset code and link.`}
        footer={
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code we emailed you on the reset page to choose a new password.
          </p>
          <Button asChild className="w-full">
            <Link to="/reset-password" state={{ email: form.email }}>
              Enter reset code
            </Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Forgot password?"
      description="Enter your email and we'll send you a reset code."
      footer={
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
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

        {error && !error.errors ? <FieldError>{errorMessage(error)}</FieldError> : null}

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset code'}
        </Button>
      </form>
    </AuthShell>
  )
}
