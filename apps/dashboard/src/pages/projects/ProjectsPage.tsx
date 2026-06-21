import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, usePagination } from 'alova/client'
import type { ProjectEnvironment } from '@arkyc/types'
import { Projects, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { humanize } from '@/lib/utils'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const ENVIRONMENTS: ProjectEnvironment[] = ['production', 'staging', 'development']

export default function ProjectsPage() {
  const tenantId = useTenantId()
  const { can } = useTenant()

  const {
    data: projects,
    page,
    isLastPage,
    loading,
    error,
    update,
    reload,
  } = usePagination(
    (currentPage, pageSize) => Projects.list(tenantId, { page: currentPage, limit: pageSize }),
    {
      append: true,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  const [open, setOpen] = useState(false)

  const {
    form,
    updateForm,
    send: createProject,
    loading: creating,
    error: createError,
    reset,
    onSuccess,
  } = useForm(
    (formData) =>
      Projects.create(tenantId, {
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
    <div className="p-8">
      <PageHeader
        title="Projects"
        description="Applications and environments scoped to this tenant."
        actions={
          can('projects.create') ? <Button onClick={() => setOpen(true)}>New project</Button> : null
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : projects.length === 0 && loading ? (
        <Loading />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start verifying users."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{project.name}</CardTitle>
                    <Badge variant="secondary">{humanize(project.environment)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Status: {humanize(project.status)}</p>
                </CardContent>
                <CardFooter>
                  <Link to={project.id} className="text-sm font-medium text-primary hover:underline">
                    Manage →
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          <InfiniteScroll
            onLoadMore={() => update({ page: page + 1 })}
            isLast={isLastPage}
            loading={loading}
          />
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="My App"
                required
              />
            </div>
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
            {createError ? (
              <p className="text-sm text-destructive">
                {errorMessage(createError, 'Failed to create project.')}
              </p>
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
