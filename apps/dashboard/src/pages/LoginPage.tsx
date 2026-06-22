import { Auth, errorMessage } from '@/lib/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FormEvent } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useForm } from 'alova/client'

export default function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(Auth.login, {
    initialForm: {
      email: '',
      password: '',
    },
  })

  onSuccess(({ data }) => {
    setUser(data.user)
    navigate('/')
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back. Sign in to your account.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary underline-offset-4 hover:underline">
                Create an account
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
