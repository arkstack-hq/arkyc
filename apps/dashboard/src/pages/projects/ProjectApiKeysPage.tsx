import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, usePagination, useRequest } from 'alova/client'
import { ApiKeys, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { formatDateTime } from '@/lib/utils'
import { Loading, ErrorState, EmptyState } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function ProjectApiKeysPage() {
  const tenantId = useTenantId()
  const { can } = useTenant()
  const { projectId } = useParams()

  const {
    data: keys,
    page,
    isLastPage,
    loading,
    error,
    update,
    reload: refreshKeys,
  } = usePagination(
    (currentPage, pageSize) =>
      ApiKeys.list(tenantId, projectId!, { page: currentPage, limit: pageSize }),
    {
      append: true,
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
    reset,
    onSuccess: onCreateSuccess,
  } = useForm((f) => ApiKeys.create(tenantId, projectId!, { name: f.name.trim() }), {
    initialForm: { name: '' },
  })

  onCreateSuccess(({ data }) => {
    setSecret(data.secret)
    reset()
    void refreshKeys()
  })

  const {
    send: revokeKey,
    loading: revoking,
    onSuccess: onRevokeSuccess,
  } = useRequest((keyId: string) => ApiKeys.revoke(tenantId, projectId!, keyId), {
    immediate: false,
  })

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

      {error ? (
        <ErrorState error={error} />
      ) : keys.length === 0 && loading ? (
        <Loading />
      ) : keys.length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create a key to authenticate server-side requests."
        />
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
                        onClick={() => void revokeKey(key.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <InfiniteScroll
            onLoadMore={() => update({ page: page + 1 })}
            isLast={isLastPage}
            loading={loading}
          />
        </>
      )}

      <Dialog open={open} onClose={closeDialog}>
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Copy this secret now — it will not be shown again.
              </DialogDescription>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="Production server"
                required
              />
            </div>
            {createError ? (
              <p className="mt-3 text-sm text-destructive">
                {errorMessage(createError, 'Failed to create key.')}
              </p>
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
