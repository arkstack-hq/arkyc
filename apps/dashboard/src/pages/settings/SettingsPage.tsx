import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
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
  const queryClient = useQueryClient()

  const [name, setName] = useState(tenant?.name ?? '')

  useEffect(() => {
    setName(tenant?.name ?? '')
  }, [tenant?.name])

  const save = useMutation({
    mutationFn: () => api.tenants.update(tenantId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

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
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canUpdate}
              />
            </div>
            {save.isError ? (
              <p className="text-sm text-destructive">
                {save.error instanceof ApiError ? save.error.message : 'Failed to save.'}
              </p>
            ) : null}
            {save.isSuccess ? <p className="text-sm text-success">Settings saved.</p> : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={() => save.mutate()}
              disabled={!canUpdate || save.isPending || name.trim() === ''}
            >
              {save.isPending ? 'Saving…' : 'Save'}
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
