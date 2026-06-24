import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, usePagination, useRequest } from 'alova/client'
import { ApiKeys, errorMessage } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { formatDateTime } from '@/lib/utils'
import { Loading, ErrorState, EmptyState } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { useConfirm } from '@/components/Confirm'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export default function ProjectApiKeysPage() {
  const organizationId = useOrganizationId()
  const { can } = useOrganization()
  const { projectId } = useParams()

  const {
    data: keys,
    page,
    pageCount,
    loading,
    error,
    update,
    reload: refreshKeys,
  } = usePagination(
    (currentPage, pageSize) => ApiKeys.list(organizationId, projectId!, { page: currentPage, limit: pageSize }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    form,
    updateForm,
    send: createKey,
    loading: creating,
    error: createError,
    update: clearCreateError,
    reset,
    onSuccess: onCreateSuccess,
  } = useForm((f) => ApiKeys.create(organizationId, projectId!, { name: f.name.trim() }), {
    initialForm: { name: '' },
  })

  onCreateSuccess(({ data }) => {
    setSecret(data.secret)
    reset()
    void refreshKeys()
  })

  const confirm = useConfirm()
  const {
    send: revokeKey,
    loading: revoking,
    onSuccess: onRevokeSuccess,
  } = useRequest((keyId: string) => ApiKeys.revoke(organizationId, projectId!, keyId), {
    immediate: false,
  })

  const confirmRevoke = async (key: { id: string; name: string }) => {
    const ok = await confirm({
      title: 'Revoke API key?',
      description: `Revoke “${key.name}”. Any integration using it will immediately stop working.`,
      confirmLabel: 'Revoke',
    })
    if (ok) await revokeKey(key.id)
  }

  onRevokeSuccess(() => {
    void refreshKeys()
  })

  const closeDialog = () => {
    setOpen(false)
    setSecret(null)
    reset()
    setCopied(false)
  }

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {can('api_keys.create') ? <Button onClick={() => setOpen(true)}>Create key</Button> : null}
      </div>

      <Card>
        <CardContent className="px-2 pb-2">
          {error ? (
            <ErrorState error={error} />
          ) : keys.length === 0 && loading ? (
            <Loading />
          ) : keys.length === 0 ? (
            <EmptyState title="No API keys" description="Create a key to authenticate server-side requests." />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Prefix</TH>
                    <TH>Last used</TH>
                    <TH>Created</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {keys.map((key) => (
                    <TR key={key.id}>
                      <TD className="font-medium">{key.name}</TD>
                      <TD className="font-mono text-xs">{key.key_prefix}</TD>
                      <TD>{formatDateTime(key.last_used_at)}</TD>
                      <TD>{formatDateTime(key.created_at)}</TD>
                      <TD className="text-right">
                        {can('api_keys.revoke') ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={revoking}
                            onClick={() => void confirmRevoke(key)}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={closeDialog}>
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>Copy this secret now — it will not be shown again.</DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-warning bg-warning/10 p-3">
              <code className="block break-all font-mono text-sm">{secret}</code>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={copySecret}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button type="button" onClick={closeDialog}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void createKey()
            }}
          >
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>Give the key a recognizable name.</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="key-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <KeyRound />
                </InputGroupAddon>
                <InputGroupInput
                  id="key-name"
                  value={form.name}
                  aria-invalid={!!createError?.flat?.name}
                  onChange={(e) => {
                    updateForm({ name: e.target.value })
                    if (createError?.errors) createError.delete('name', clearCreateError)
                  }}
                  placeholder="Production server"
                  required
                />
              </InputGroup>
              <FieldError errors={createError?.list?.name} />
            </Field>
            {createError && !createError.errors ? (
              <FieldError className="mt-3">{errorMessage(createError, 'Failed to create key.')}</FieldError>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !form.name.trim()}>
                {creating ? <Spinner /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  )
}
