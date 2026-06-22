import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRequest } from 'alova/client'
import type { Permission } from '@arkyc/types'
import { Permissions } from '@/lib/api'
import { useTenantId } from '@/contexts/tenant-context'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { humanize } from '@/lib/utils'

export default function PermissionsPage() {
  const tenantId = useTenantId()

  const { data: catalogue, loading, error } = useRequest(Permissions.list(tenantId), { initialData: [] })

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const perm of catalogue) {
      const list = map.get(perm.group) ?? []
      list.push(perm)
      map.set(perm.group, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [catalogue])

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Permission Catalog"
        description="All permissions recognized by Arkyc."
        actions={
          <Link to="../" className="text-sm text-primary hover:underline">
            ← Settings
          </Link>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
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
