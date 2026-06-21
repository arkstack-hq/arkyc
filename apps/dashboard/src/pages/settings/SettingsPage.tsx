import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'alova/client'
import { Tenants, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

export default function SettingsPage() {
  const tenantId = useTenantId()
  const { tenant, can } = useTenant()

  const [saved, setSaved] = useState(false)

  const { form, updateForm, send, loading, error, onSuccess } = useForm(
    (formData) => Tenants.update(tenantId, { name: formData.name }),
    { initialForm: { name: tenant?.name ?? '' } },
  )

  onSuccess(() => setSaved(true))

  const canUpdate = can('settings.update')

  return (
    <div>
      <PageHeader title="Settings" description="Manage your organization." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tenant</CardTitle>
            <CardDescription>General organization details.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenant-name">Name</Label>
              <Input
                id="tenant-name"
                value={form.name}
                onChange={(e) => {
                  updateForm({ name: e.target.value })
                  setSaved(false)
                }}
                disabled={!canUpdate}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{errorMessage(error, 'Failed to save.')}</p>
            ) : null}
            {saved ? <p className="text-sm text-success">Settings saved.</p> : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={() => void send()}
              disabled={!canUpdate || loading || form.name.trim() === ''}
            >
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access control</CardTitle>
            <CardDescription>Roles and permissions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link to="roles">
              <Button variant="outline" className="w-full justify-start">
                Manage roles
              </Button>
            </Link>
            <Link to="permissions">
              <Button variant="outline" className="w-full justify-start">
                Permission catalog
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
