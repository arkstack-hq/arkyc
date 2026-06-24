import { Link } from 'react-router-dom'
import { usePagination } from 'alova/client'
import { Building2, CalendarDays, ChevronRight } from 'lucide-react'
import { Admin } from '@/lib/api'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Deterministic accent tints so cards read as distinct at a glance. */
const ACCENTS = [
  'bg-primary/10 text-primary',
  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  'bg-rose-500/10 text-rose-600 dark:text-rose-400',
]

function accent(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0]!
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  return letters || '?'
}

export default function AdminOrganizationsPage() {
  const {
    data: organizations,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination((currentPage, pageSize) => Admin.organizations({ page: currentPage, limit: pageSize }), {
    append: false,
    initialPage: 1,
    initialPageSize: 12,
    data: (res) => res.data,
    total: (res) => res.meta.total,
  })

  if (loading && organizations.length === 0) return <Loading />
  if (error) return <ErrorState error={error} />

  return (
    <div>
      <PageHeader title="Organizations" description="Every organization on the platform." />

      {organizations.length === 0 ? (
        <EmptyState title="No organizations yet" description="Organizations appear here once created." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((organization) => (
              <Link key={organization.id} to={`/admin/organizations/${organization.id}`} className="group block">
                <Card className="flex h-full flex-col gap-4 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11 rounded-xl">
                      {organization.logo_url ? (
                        <AvatarImage src={organization.logo_url} alt={organization.name} className="rounded-xl" />
                      ) : null}
                      <AvatarFallback className={cn('rounded-xl text-sm font-semibold', accent(organization.id))}>
                        {initials(organization.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-foreground">{organization.name}</div>
                      <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="size-3 shrink-0" />
                        <span className="truncate">{organization.slug}</span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>

                  <div className="mt-auto flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5 shrink-0" />
                    Created{' '}
                    {new Date(organization.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
        </>
      )}
    </div>
  )
}
