import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectEnvironment } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { humanize } from '@/lib/utils'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
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
  const qc = useQueryClient()

  const projectsQuery = useQuery({
    queryKey: ['projects', tenantId],
    queryFn: () => api.projects.list(tenantId),
  })

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [environment, setEnvironment] = useState<ProjectEnvironment>('production')

  const createMutation = useMutation({
    mutationFn: () => api.projects.create(tenantId, { name: name.trim(), environment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', tenantId] })
      setOpen(false)
      setName('')
      setEnvironment('production')
    },
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

      {projectsQuery.isLoading ? (
        <Loading />
      ) : projectsQuery.isError ? (
        <ErrorState error={projectsQuery.error} />
      ) : (projectsQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start verifying users."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projectsQuery.data ?? []).map((project) => (
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
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Name the project and choose its environment.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My App"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-env">Environment</Label>
              <Select
                id="project-env"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as ProjectEnvironment)}
              >
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>
                    {humanize(env)}
                  </option>
                ))}
              </Select>
            </div>
            {createMutation.isError ? (
              <p className="text-sm text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create project.'}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? <Spinner /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
