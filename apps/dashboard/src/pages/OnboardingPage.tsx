import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'alova/client'
import { Tenants, errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function OnboardingPage() {
  const navigate = useNavigate()

  const { form, updateForm, send, loading, error, onSuccess } = useForm(
    (formData) => Tenants.create({ name: formData.name.trim() }),
    { initialForm: { name: '' } },
  )

  onSuccess(({ data }) => {
    navigate(`/t/${data.slug}/overview`)
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    void send()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>
            Organizations group your projects, sessions, and team members.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Acme Inc."
                required
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{errorMessage(error)}</p> : null}
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
