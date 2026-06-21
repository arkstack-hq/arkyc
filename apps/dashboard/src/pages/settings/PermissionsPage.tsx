import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Permission } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { humanize } from '@/lib/utils'

export default function PermissionsPage() {
  const tenantId = useTenantId()

  const catalogQuery = useQuery({
    queryKey: ['permissions', tenantId],
    queryFn: () => api.permissions.list(tenantId),
  })

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const perm of catalogQuery.data ?? []) {
      const list = map.get(perm.group) ?? []
      list.push(perm)
      map.set(perm.group, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [catalogQuery.data])

  return (
    <div>
      <PageHeader
        title="Permission Catalog"
        description="All permissions recognized by Arkyc."
        actions={
          <Link to="../" className="text-sm text-primary hover:underline">
            ← Settings
          </Link>
        }
      />

      {catalogQuery.isLoading ? (
        <Loading />
      ) : catalogQuery.isError ? (
        <ErrorState error={catalogQuery.error} />
      ) : grouped.length === 0 ? (
        <EmptyState title="No permissions" />
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([group, perms]) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{humanize(group)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <THead>
                    <TR>
                      <TH>Code</TH>
                      <TH>Description</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {perms.map((perm) => (
                      <TR key={perm.name}>
                        <TD className="font-mono text-xs">{perm.name}</TD>
                        <TD className="text-muted-foreground">{perm.description ?? '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
