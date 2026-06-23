import { Auth, errorMessage } from '@/lib/api'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import type { FormEvent } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useForm } from 'alova/client'

const HIGHLIGHTS = [
  'Identity verification that fits your brand',
  'Document, liveness and face-match checks',
  'Real-time decisions across your organizations',
]

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
    <div className="flex min-h-screen">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-linear-to-br from-[#7a5c00] via-[#a9780a] to-[#3a2c05] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(60% 50% at 20% 0%, rgba(255,220,140,0.45), transparent), radial-gradient(50% 50% at 100% 100%, rgba(0,0,0,0.45), transparent)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <Logo className="size-9" />
          <span className="text-lg font-semibold tracking-tight text-white">Arkyc</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">Verify identities with confidence.</h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-50/80">
            Onboard and verify your users with a flow you control — branded, secure, and decided in real time.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-amber-50/90">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <ShieldCheck className="size-3.5 text-amber-100" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-amber-50/50">© {new Date().getFullYear()} Arkyc</p>
      </aside>

      {/* Form panel */}
      <main className="flex w-full flex-col items-center justify-center bg-background p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo className="size-8" />
            <span className="text-lg font-semibold tracking-tight">Arkyc</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back. Sign in to your account.</p>
          </div>

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

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
