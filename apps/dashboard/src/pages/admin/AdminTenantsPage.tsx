import { useRequest } from 'alova/client'
import { Admin } from '@/lib/api'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

export default function AdminTenantsPage() {
  const { data: tenants, loading, error } = useRequest(Admin.tenants(), { initialData: [] })

  if (loading && tenants.length === 0) return <Loading />
  if (error) return <ErrorState error={error} />

  return (
    <div>
      <PageHeader title="Tenants" description="Every organization on the platform." />

      <Card>
        <CardContent className="px-2 pb-2">
          {tenants.length === 0 ? (
            <EmptyState title="No tenants yet" description="Tenants appear here once created." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Slug</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {tenants.map((tenant) => (
                  <TR key={tenant.id}>
                    <TD className="font-medium">{tenant.name}</TD>
                    <TD className="text-muted-foreground">{tenant.slug}</TD>
                    <TD className="text-muted-foreground">{new Date(tenant.created_at).toLocaleDateString()}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
