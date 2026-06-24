import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { cn, humanize } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Projects } from '@/lib/api'
import { useOrganizationId } from '@/contexts/organization-context'
import { useRequest } from 'alova/client'

const TABS = [
  { to: '', label: 'Settings', end: true },
  { to: 'api-keys', label: 'API Keys', end: false },
  { to: 'webhooks', label: 'Webhooks', end: false },
]

export default function ProjectDetailLayout() {
  const organizationId = useOrganizationId()
  const { projectId } = useParams()

  const {
    data: project,
    loading,
    error,
  } = useRequest(Projects.get(organizationId, projectId!), {
    immediate: !!projectId,
  })

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} />

  return (
    <div className="p-6 lg:p-8">
      <Link to="../projects" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Projects
      </Link>
      <PageHeader
        title={project?.name ?? 'Project'}
        actions={project ? <Badge variant="secondary">{humanize(project.environment)}</Badge> : null}
      />

      <nav className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
