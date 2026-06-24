import { Boxes, Sparkles } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Projects, errorMessage } from '@/lib/api'
import { formatDateTime, humanize } from '@/lib/utils'
import { useForm, usePagination } from 'alova/client'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Link } from 'react-router-dom'
import { Pagination } from '@/components/Pagination'
import type { ProjectEnvironment } from '@arkyc/types'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useState } from 'react'

const ENVIRONMENTS: ProjectEnvironment[] = ['production', 'staging', 'development']

function statusVariant(status: string): 'success' | 'warning' | 'muted' {
  if (status === 'active') return 'success'
  if (status === 'disabled' || status === 'archived') return 'muted'
  return 'warning'
}

export default function ProjectsPage() {
  const organizationId = useOrganizationId()
  const { can } = useOrganization()

  const {
    data: projects,
    page,
    pageCount,
    loading,
    error,
    update,
    reload,
  } = usePagination((currentPage, pageSize) => Projects.list(organizationId, { page: currentPage, limit: pageSize }), {
    append: false,
    initialPage: 1,
    initialPageSize: 15,
    data: (res) => res.data,
    total: (res) => res.meta.total,
  })

  const [open, setOpen] = useState(false)

  const {
    form,
    updateForm,
    send: createProject,
    loading: creating,
    error: createError,
    update: clearCreateError,
    reset,
    onSuccess,
  } = useForm(
    (formData) =>
      Projects.create(organizationId, {
        name: formData.name.trim(),
        environment: formData.environment,
      }),
    { initialForm: { name: '', environment: 'production' as ProjectEnvironment } },
  )

  onSuccess(() => {
    setOpen(false)
    reset()
    void reload()
  })

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Projects"
        description="Applications and environments scoped to this organization."
        actions={can('projects.create') ? <Button onClick={() => setOpen(true)}>New project</Button> : null}
      />

      {error ? (
        <ErrorState error={error} />
      ) : projects.length === 0 && loading ? (
        <Loading />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to start verifying users." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="flex flex-col transition-colors hover:border-ring/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Boxes className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{project.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{humanize(project.environment)}</p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(project.status)}>
                      {humanize(project.status)} {project.has_ai_grant ? <Sparkles size={12} className="ml-1" /> : null}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-xs text-muted-foreground">Created {formatDateTime(project.created_at)}</p>
                </CardContent>
                <CardFooter className="border-t border-border pt-4">
                  <Link to={project.id} className="text-sm font-medium text-primary hover:underline">
                    Manage →
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Name the project and choose its environment.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void createProject()
          }}
        >
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="project-name"
                  value={form.name}
                  aria-invalid={!!createError?.flat?.name}
                  onChange={(e) => {
                    updateForm({ name: e.target.value })
                    if (createError?.errors) createError.delete('name', clearCreateError)
                  }}
                  placeholder="My App"
                  required
                />
              </InputGroup>
              <FieldError errors={createError?.list?.name} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-env">Environment</Label>
              <Select
                id="project-env"
                value={form.environment}
                onChange={(e) => updateForm({ environment: e.target.value as ProjectEnvironment })}
              >
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>
                    {humanize(env)}
                  </option>
                ))}
              </Select>
            </div>
            {createError && !createError.errors ? (
              <FieldError>{errorMessage(createError, 'Failed to create project.')}</FieldError>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !form.name.trim()}>
              {creating ? <Spinner /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
