import { useForm, useRequest } from 'alova/client'
import { Link } from 'react-router-dom'
import type { Project, ProjectEnvironment } from '@arkyc/types'
import { BusinessVerifications, Projects, errorMessage } from '@/lib/api'
import { humanize } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useState } from 'react'

const ENVIRONMENTS: ProjectEnvironment[] = ['production', 'staging', 'development']

/** Creates a new project from this project's settings and branding, in an environment the user picks. */
export function CloneProjectCard({
  organizationId,
  project,
  onCloned,
}: {
  organizationId: string
  project: Project
  onCloned: (clone: Project) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: verification } = useRequest(BusinessVerifications.state(organizationId))
  const canGoLive = verification?.can_go_live ?? false

  const { form, updateForm, send, loading, error, update, reset, onSuccess } = useForm(
    (formData) =>
      Projects.clone(organizationId, project.id, { name: formData.name.trim(), environment: formData.environment }),
    {
      initialForm: {
        name: `${project.name} copy`,
        environment: (project.environment === 'production' ? 'staging' : project.environment) as ProjectEnvironment,
      },
    },
  )

  onSuccess(({ data }) => {
    setOpen(false)
    reset()
    onCloned(data)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clone project</CardTitle>
        <CardDescription>
          Start a new project with this project's settings and branding. API keys, webhooks, members and sessions are
          not copied.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Clone project
        </Button>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <DialogHeader>
            <DialogTitle>Clone {project.name}</DialogTitle>
            <DialogDescription>Name the new project and choose its environment.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="clone-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="clone-name"
                  value={form.name}
                  autoFocus
                  aria-invalid={!!error?.flat?.name}
                  onChange={(e) => {
                    updateForm({ name: e.target.value })
                    if (error?.errors) error.delete('name', update)
                  }}
                  required
                />
              </InputGroup>
              <FieldError errors={error?.list?.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="clone-env">Environment</FieldLabel>
              <Select
                id="clone-env"
                value={form.environment}
                onChange={(e) => {
                  updateForm({ environment: e.target.value as ProjectEnvironment })
                  if (error?.errors) error.delete('environment', update)
                }}
              >
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env} disabled={env === 'production' && !canGoLive}>
                    {humanize(env)}
                    {env === 'production' && !canGoLive ? ' (verify your business first)' : ''}
                  </option>
                ))}
              </Select>
              {!canGoLive ? (
                <p className="text-xs text-muted-foreground">
                  Production projects need a verified business.{' '}
                  <Link to="../../settings/verification" relative="path" className="text-primary hover:underline">
                    Verify your business
                  </Link>
                </p>
              ) : null}
              <FieldError errors={error?.list?.environment} />
            </Field>
            {error && !error.errors ? (
              <FieldError>{errorMessage(error, 'Failed to clone the project.')}</FieldError>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? <Spinner /> : null}
              Clone
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Card>
  )
}
