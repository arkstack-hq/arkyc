import { useRequest } from 'alova/client'
import { Admin } from '@/lib/api'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

export default function AdminOrganizationsPage() {
  const { data: organizations, loading, error } = useRequest(Admin.organizations(), { initialData: [] })

  if (loading && organizations.length === 0) return <Loading />
  if (error) return <ErrorState error={error} />

  return (
    <div>
      <PageHeader title="Organizations" description="Every organization on the platform." />

      <Card>
        <CardContent className="px-2 pb-2">
          {organizations.length === 0 ? (
            <EmptyState title="No organizations yet" description="Organizations appear here once created." />
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
                {organizations.map((organization) => (
                  <TR key={organization.id}>
                    <TD className="font-medium">{organization.name}</TD>
                    <TD className="text-muted-foreground">{organization.slug}</TD>
                    <TD className="text-muted-foreground">{new Date(organization.created_at).toLocaleDateString()}</TD>
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
