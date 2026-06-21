import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiKey } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { formatDateTime } from '@/lib/utils'
import { Loading, ErrorState, EmptyState } from '@/components/States'
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
  const qc = useQueryClient()

  const keysQuery = useQuery({
    queryKey: ['apiKeys', tenantId, projectId],
    queryFn: () => api.apiKeys.list(tenantId, projectId!),
    enabled: !!projectId,
  })

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const createMutation = useMutation({
    mutationFn: () => api.apiKeys.create(tenantId, projectId!, { name: name.trim() }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['apiKeys', tenantId, projectId] })
      setSecret(result.secret)
      setName('')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.apiKeys.revoke(tenantId, projectId!, keyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apiKeys', tenantId, projectId] }),
  })

  const closeDialog = () => {
    setOpen(false)
    setSecret(null)
    setName('')
    setCopied(false)
    createMutation.reset()
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

  const keys: ApiKey[] = keysQuery.data ?? []

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {can('api_keys.create') ? <Button onClick={() => setOpen(true)}>Create key</Button> : null}
      </div>

      {keysQuery.isLoading ? (
        <Loading />
      ) : keysQuery.isError ? (
        <ErrorState error={keysQuery.error} />
      ) : keys.length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create a key to authenticate server-side requests."
        />
      ) : (
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
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(key.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
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
              createMutation.mutate()
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production server"
                required
              />
            </div>
            {createMutation.isError ? (
              <p className="mt-3 text-sm text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create key.'}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
                {createMutation.isPending ? <Spinner /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  )
}
