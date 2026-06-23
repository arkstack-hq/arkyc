import { Auth, errorMessage } from '@/lib/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel, FieldSet } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useForm } from 'alova/client'

export default function RegisterPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm((formData) => Auth.register(formData), {
    initialForm: {
      firstname: '',
      lastname: '',
      email: '',
      password: '',
    },
  })

  onSuccess(({ data }) => {
    setUser(data.user)
    // New accounts land on email verification before entering the app.
    navigate('/verify-email')
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
          A
        </span>
        <span className="text-lg font-semibold tracking-tight">Arkyc</span>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Get started with your verification dashboard.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
            <FieldSet className="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel htmlFor="firstname">First Name</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <User />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="firstname"
                    type="text"
                    autoComplete="firstname"
                    required
                    value={form.firstname}
                    aria-invalid={!!error?.flat?.firstname}
                    onChange={(e) => {
                      updateForm({ firstname: e.target.value })
                      if (error?.errors) error.delete('firstname', update)
                    }}
                  />
                </InputGroup>
                <FieldError errors={error?.list?.firstname} />
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Last Name</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <User />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="lastname"
                    type="text"
                    autoComplete="lastname"
                    required
                    value={form.lastname}
                    aria-invalid={!!error?.flat?.lastname}
                    onChange={(e) => {
                      updateForm({ lastname: e.target.value })
                      if (error?.errors) error.delete('lastname', update)
                    }}
                  />
                </InputGroup>
                <FieldError errors={error?.list?.lastname} />
              </Field>
            </FieldSet>
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
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Lock />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type="password"
                  autoComplete="new-password"
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
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
