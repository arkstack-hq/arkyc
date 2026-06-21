import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useTenantId } from '@/lib/tenant'
import { cn } from '@/lib/utils'
import { PageHeader, Loading, ErrorState } from '@/components/States'

const TABS = [
  { to: '', label: 'Settings', end: true },
  { to: 'api-keys', label: 'API Keys', end: false },
  { to: 'webhooks', label: 'Webhooks', end: false },
]

export default function ProjectDetailLayout() {
  const tenantId = useTenantId()
  const { projectId } = useParams()

  const projectQuery = useQuery({
    queryKey: ['project', tenantId, projectId],
    queryFn: () => api.projects.get(tenantId, projectId!),
    enabled: !!projectId,
  })

  if (projectQuery.isLoading) return <Loading />
  if (projectQuery.isError) return <ErrorState error={projectQuery.error} />

  const project = projectQuery.data

  return (
    <div className="p-8">
      <Link
        to="../"
        className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Projects
      </Link>
      <PageHeader title={project?.name ?? 'Project'} />

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
