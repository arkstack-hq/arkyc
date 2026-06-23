import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'alova/client'
import { Organizations, errorMessage } from '@/lib/api'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function OnboardingPage() {
  const navigate = useNavigate()

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData) => Organizations.create({ name: formData.name.trim() }),
    { initialForm: { name: '' } },
  )

  onSuccess(({ data }) => {
    navigate(`/o/${data.slug}/overview`)
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
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
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>Organizations group your projects, sessions, and team members.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="name">Organization name</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Building2 />
                </InputGroupAddon>
                <InputGroupInput
                  id="name"
                  type="text"
                  placeholder="Acme Inc."
                  required
                  value={form.name}
                  aria-invalid={!!error?.flat?.name}
                  onChange={(e) => {
                    updateForm({ name: e.target.value })
                    if (error?.errors) error.delete('name', update)
                  }}
                />
              </InputGroup>
              <FieldError errors={error?.list?.name} />
            </Field>
            {error && !error.errors ? <FieldError>{errorMessage(error)}</FieldError> : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
