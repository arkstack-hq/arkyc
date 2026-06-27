import { ArrowDown, ArrowUp, Check, Copy, Workflow as WorkflowIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { useConfirm } from '@/components/Confirm'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import type { AddressMethod, Workflow, WorkflowStep, WorkflowStepKey } from '@arkyc/types'
import { Workflows, errorMessage } from '@/lib/api'
import { useCallback, useState } from 'react'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ADDRESS_METHODS,
  AVAILABLE_WORKFLOW_STEP_KEYS,
  DEFAULT_ADDRESS_CONFIG,
  DEFAULT_WORKFLOW_CONFIG,
} from '@arkyc/types'
import { Spinner } from '@/components/ui/spinner'
import { useRequest } from 'alova/client'

/** Human labels for the coarse verification stages. */
const STAGE: Record<WorkflowStepKey, { label: string; description: string }> = {
  document: { label: 'Document capture', description: 'Capture the ID document' },
  address: { label: 'Address verification', description: 'Verify the user’s residential address' },
  liveness: { label: 'Liveness & selfie', description: 'Selfie and liveness check' },
  face_match: { label: 'Face match', description: 'Match the selfie to the document portrait' },
}

/** Labels for the address-verification methods. */
const ADDRESS_METHOD_LABEL: Record<AddressMethod, string> = {
  poa_document: 'Proof-of-address document',
  device_location: 'Device location (GPS)',
  geocode_lookup: 'Address lookup (geocode)',
}

interface Draft {
  id: string | null
  name: string
  steps: WorkflowStep[]
  skipOcr: boolean
}

/** Ensure every available stage has a row, appending missing ones as disabled. */
const withAllStages = (steps: WorkflowStep[]): WorkflowStep[] => {
  const present = new Set(steps.map((s) => s.key))
  const extras = AVAILABLE_WORKFLOW_STEP_KEYS.filter((key) => !present.has(key)).map((key) => ({ key, enabled: false }))
  return [...steps.map((s) => ({ ...s })), ...extras]
}

const newDraft = (): Draft => ({
  id: null,
  name: '',
  steps: withAllStages(DEFAULT_WORKFLOW_CONFIG.steps),
  skipOcr: DEFAULT_WORKFLOW_CONFIG.options.skip_ocr,
})

const toDraft = (workflow: Workflow): Draft => ({
  id: workflow.id,
  name: workflow.name,
  steps: withAllStages(workflow.steps),
  skipOcr: workflow.options.skip_ocr,
})

export default function WorkflowsPage() {
  const organizationId = useOrganizationId()
  const { can } = useOrganization()

  const {
    data: workflows,
    loading,
    error,
    send: refresh,
  } = useRequest(Workflows.list(organizationId), { initialData: [] as Workflow[] })

  const [draft, setDraft] = useState<Draft | null>(null)

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Workflows" description="Order or disable verification stages." />

      <div className="mb-4 flex justify-end">
        {can('workflows.create') ? <Button onClick={() => setDraft(newDraft())}>New workflow</Button> : null}
      </div>

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
              onEdit={() => setDraft(toDraft(workflow))}
              onDeleted={refresh}
              organizationId={organizationId}
            />
          ))}
        </div>
      )}

      {draft ? (
        <WorkflowEditor
          organizationId={organizationId}
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            void refresh()
          }}
        />
      ) : null}
    </div>
  )
}

/** A single workflow summary card: stage order, skip-OCR, and the copyable ID. */
function WorkflowCard({
  workflow,
  canEdit,
  canDelete,
  onEdit,
  onDeleted,
  organizationId,
}: {
  workflow: Workflow
  canEdit: boolean
  canDelete: boolean
  onEdit: () => void
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
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
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

/** Create/edit dialog: reorder stages, toggle them, and toggle skip-OCR. */
function WorkflowEditor({
  organizationId,
  draft,
  onClose,
  onSaved,
}: {
  organizationId: string
  draft: Draft
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(draft.name)
  const [steps, setSteps] = useState<WorkflowStep[]>(draft.steps)
  const [skipOcr, setSkipOcr] = useState(draft.skipOcr)

  const { send, loading, error } = useRequest(
    () => {
      const input = { name: name.trim(), steps, options: { skip_ocr: skipOcr } }

      return draft.id ? Workflows.update(organizationId, draft.id, input) : Workflows.create(organizationId, input)
    },
    { immediate: false },
  )

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setSteps(next)
  }

  const toggle = (index: number) => {
    setSteps(
      steps.map((s, i) => {
        if (i !== index) return s
        const enabled = !s.enabled
        // Seed a default config when the address stage is first enabled.
        const config = s.key === 'address' && enabled ? (s.config ?? DEFAULT_ADDRESS_CONFIG) : s.config
        return { ...s, enabled, config }
      }),
    )
  }

  /** Patch the address stage's config (methods / on_fail) at `index`. */
  const patchAddress = (index: number, patch: Partial<NonNullable<WorkflowStep['config']>>) => {
    setSteps(
      steps.map((s, i) => (i === index ? { ...s, config: { ...DEFAULT_ADDRESS_CONFIG, ...s.config, ...patch } } : s)),
    )
  }

  const toggleMethod = (index: number, method: AddressMethod) => {
    const current = steps[index]?.config?.methods ?? DEFAULT_ADDRESS_CONFIG.methods
    const methods = current.includes(method) ? current.filter((m) => m !== method) : [...current, method]
    patchAddress(index, { methods })
  }

  const documentEnabled = steps.some((s) => s.key === 'document' && s.enabled)
  const anyEnabled = steps.some((s) => s.enabled)
  const fieldErrors =
    error && 'list' in error ? (error as { list?: Record<string, Array<{ message?: string }>> }).list : undefined

  const onSubmit = async () => {
    await send()
    onSaved()
  }

  return (
    <Dialog open onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void onSubmit()
        }}
      >
        <DialogHeader>
          <DialogTitle>{draft.id ? 'Edit workflow' : 'New workflow'}</DialogTitle>
          <DialogDescription>Drag stages into order, turn them off, or skip OCR parsing.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="workflow-name">Name</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <WorkflowIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="workflow-name"
                value={name}
                required
                placeholder="e.g. Document capture only"
                onChange={(e) => setName(e.target.value)}
              />
            </InputGroup>
            <FieldError errors={fieldErrors?.name} />
          </Field>

          <div className="flex flex-col gap-2">
            <FieldLabel>Stages</FieldLabel>
            <ul className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <li key={step.key} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={i === steps.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${step.enabled ? '' : 'text-muted-foreground'}`}>
                        {STAGE[step.key].label}
                      </p>
                      <p className="text-xs text-muted-foreground">{STAGE[step.key].description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={step.enabled}
                        onChange={() => toggle(i)}
                        className="h-4 w-4 rounded border-input"
                      />
                      On
                    </label>
                  </div>

                  {step.key === 'address' && step.enabled ? (
                    <div className="flex flex-col gap-2 border-t border-border pt-3 pl-7">
                      <p className="text-xs font-medium text-muted-foreground">Methods</p>
                      <div className="flex flex-col gap-1.5">
                        {ADDRESS_METHODS.map((method) => (
                          <label key={method} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={(step.config?.methods ?? []).includes(method)}
                              onChange={() => toggleMethod(i, method)}
                              className="h-4 w-4 rounded border-input"
                            />
                            {ADDRESS_METHOD_LABEL[method]}
                          </label>
                        ))}
                      </div>
                      <label className="mt-1 flex items-center gap-2 text-sm">
                        On failure
                        <select
                          value={step.config?.on_fail ?? 'review'}
                          onChange={(e) => patchAddress(i, { on_fail: e.target.value as 'review' | 'reject' })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          <option value="review">Flag for review</option>
                          <option value="reject">Reject</option>
                        </select>
                      </label>
                      <label className="mt-1 flex items-center gap-2 text-sm">
                        Auto-verify at score
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={step.config?.auto_approve_threshold ?? ''}
                          onChange={(e) =>
                            patchAddress(i, {
                              auto_approve_threshold: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          placeholder="0.60"
                          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        A passed address scoring below this is held for manual review. Blank uses the project default.
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <FieldError errors={fieldErrors?.steps} />
          </div>

          {documentEnabled ? (
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={skipOcr}
                onChange={(e) => setSkipOcr(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                <span className="font-medium">Skip OCR parsing</span>
                <span className="block text-xs text-muted-foreground">
                  Capture the document image but don&apos;t extract its data — hand the asset URLs to a third party.
                  Disables face match.
                </span>
              </span>
            </label>
          ) : null}

          {error && !fieldErrors ? <FieldError>{errorMessage(error, 'Failed to save workflow.')}</FieldError> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim() || !anyEnabled}>
            {loading ? <Spinner /> : null}
            {draft.id ? 'Save changes' : 'Create workflow'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
