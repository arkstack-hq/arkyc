import { Check, Copy, Workflow as WorkflowIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRequest } from 'alova/client'
import type { Workflow } from '@arkyc/types'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { useConfirm } from '@/components/Confirm'
import { Workflows } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STAGE } from '@/pages/workflows/WorkflowEditorPage'

export default function WorkflowsPage() {
  const organizationId = useOrganizationId()
  const { can } = useOrganization()

  const {
    data: workflows,
    loading,
    error,
    send: refresh,
  } = useRequest(Workflows.list(organizationId), { initialData: [] as Workflow[] })

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Workflows"
        description="Choose which checks run, in what order, and how risk signals affect the decision."
        actions={
          can('workflows.create') ? (
            <Button asChild>
              <Link to="new">New workflow</Link>
            </Button>
          ) : null
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : loading && workflows.length === 0 ? (
        <Loading />
      ) : workflows.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          description="Create one to customise which verification stages run, and in what order."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              canEdit={can('workflows.update')}
              canDelete={can('workflows.delete')}
              onDeleted={refresh}
              organizationId={organizationId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** A single workflow summary card: stage order, skip-OCR, and the copyable ID. */
function WorkflowCard({
  workflow,
  canEdit,
  canDelete,
  onDeleted,
  organizationId,
}: {
  workflow: Workflow
  canEdit: boolean
  canDelete: boolean
  onDeleted: () => void
  organizationId: string
}) {
  const confirm = useConfirm()
  const { send: remove, loading: deleting } = useRequest(() => Workflows.remove(organizationId, workflow.id), {
    immediate: false,
  })

  const onDelete = useCallback(async () => {
    const ok = await confirm({
      title: 'Delete workflow?',
      description: `Delete the workflow “${workflow.name}”. In-flight sessions keep their settings.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    await remove()
    onDeleted()
  }, [confirm, remove, onDeleted, workflow.name])

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <WorkflowIcon className="size-4" />
            </span>
            <span className="font-medium">{workflow.name}</span>
          </div>
          {workflow.options.skip_ocr ? <Badge variant="secondary">OCR skipped</Badge> : null}
        </div>

        <ol className="flex flex-col gap-1 text-sm">
          {workflow.steps.map((step, i) => (
            <li key={step.key} className="flex items-center gap-2">
              <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
              <span className={step.enabled ? '' : 'text-muted-foreground line-through'}>{STAGE[step.key].label}</span>
              {!step.enabled ? <span className="text-xs text-muted-foreground">(off)</span> : null}
            </li>
          ))}
        </ol>

        <CopyableId id={workflow.id} />

        <div className="flex justify-end gap-2">
          {canEdit ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={workflow.id}>Edit</Link>
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="destructive" size="sm" disabled={deleting} onClick={() => void onDelete()}>
              Delete
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/** The workflow ID with a copy button — used as `workflowId` in the SDK. */
function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(id).then(() => setCopied(true))
  }, [id])

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy workflow ID"
      className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      <span className="truncate">{id}</span>
    </button>
  )
}
