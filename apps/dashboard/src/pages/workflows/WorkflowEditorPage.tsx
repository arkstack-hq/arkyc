import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FileText,
  MapPin,
  ScanFace,
  ShieldAlert,
  UserCheck,
  Workflow as WorkflowIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  ADDRESS_METHODS,
  AVAILABLE_WORKFLOW_STEP_KEYS,
  DEFAULT_ADDRESS_CONFIG,
  DEFAULT_SCREENING_CONFIG,
  DEFAULT_WORKFLOW_CONFIG,
  type AddressMethod,
  type AddressStepConfig,
  type RiskPolicyConfig,
  type RiskSignalKey,
  type ScreeningStepConfig,
  type Workflow,
  type WorkflowStep,
  type WorkflowStepKey,
} from '@arkyc/types'
import { Workflows, errorMessage } from '@/lib/api'
import { RiskPolicyCard } from './RiskPolicyCard'
import { useOrganizationId } from '@/contexts/organization-context'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

/** Human labels and icons for the verification stages. */
export const STAGE: Record<WorkflowStepKey, { label: string; description: string; icon: LucideIcon }> = {
  document: { label: 'Document capture', description: 'Photograph the ID and read its data.', icon: FileText },
  screening: {
    label: 'Watchlist screening',
    description: 'Check the extracted identity against sanctions and PEP lists.',
    icon: ShieldAlert,
  },
  address: { label: 'Address verification', description: 'Confirm where the user lives.', icon: MapPin },
  liveness: { label: 'Liveness & selfie', description: 'Prove a live person is present.', icon: ScanFace },
  face_match: { label: 'Face match', description: 'Match the selfie to the document photo.', icon: UserCheck },
}

const ADDRESS_METHOD_LABEL: Record<AddressMethod, string> = {
  poa_document: 'Proof-of-address document',
  device_location: 'Device location (GPS)',
  geocode_lookup: 'Address lookup (geocode)',
}

interface Draft {
  name: string
  steps: WorkflowStep[]
  skipOcr: boolean
  minAge: string
  riskPolicy: RiskPolicyConfig
}

/** Every available stage, keeping the saved order and appending missing ones as off. */
const withAllStages = (steps: WorkflowStep[]): WorkflowStep[] => {
  const present = new Set(steps.map((s) => s.key))
  const extras = AVAILABLE_WORKFLOW_STEP_KEYS.filter((key) => !present.has(key)).map((key) => ({ key, enabled: false }))

  return [...steps.map((s) => ({ ...s })), ...extras]
}

const toDraft = (workflow: Workflow | null): Draft => ({
  name: workflow?.name ?? '',
  steps: withAllStages(workflow?.steps ?? DEFAULT_WORKFLOW_CONFIG.steps),
  skipOcr: workflow?.options.skip_ocr ?? false,
  minAge: workflow?.options.min_age ? String(workflow.options.min_age) : '',
  riskPolicy: workflow?.options.risk_policy ?? {},
})

const addressConfig = (step: WorkflowStep): AddressStepConfig => ({
  ...DEFAULT_ADDRESS_CONFIG,
  ...((step.config as AddressStepConfig | undefined) ?? {}),
})

const screeningConfig = (step: WorkflowStep): ScreeningStepConfig => ({
  ...DEFAULT_SCREENING_CONFIG,
  ...((step.config as ScreeningStepConfig | undefined) ?? {}),
})

/** Create or edit a workflow (`workflows/new`, `workflows/:workflowId`). */
export default function WorkflowEditorPage() {
  const organizationId = useOrganizationId()
  const { workflowId } = useParams()
  const { data, loading, error } = useRequest(() => Workflows.get(organizationId, workflowId!), {
    immediate: !!workflowId,
  })

  if (!workflowId) return <WorkflowEditor workflow={null} />
  if (error) return <ErrorState error={error} />
  if (loading || !data) return <Loading />

  return <WorkflowEditor key={data.id} workflow={data} />
}

function WorkflowEditor({ workflow }: { workflow: Workflow | null }) {
  const organizationId = useOrganizationId()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => toDraft(workflow))
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }))

  const { send, loading, error } = useRequest(
    () => {
      const input = {
        name: draft.name.trim(),
        steps: draft.steps,
        options: {
          skip_ocr: draft.skipOcr,
          min_age: draft.minAge === '' ? undefined : Number(draft.minAge),
          risk_policy: draft.riskPolicy,
        },
      }

      return workflow ? Workflows.update(organizationId, workflow.id, input) : Workflows.create(organizationId, input)
    },
    { immediate: false },
  )

  const fieldErrors =
    error && 'list' in error ? (error as { list?: Record<string, Array<{ message?: string }>> }).list : undefined

  const enabled = (key: WorkflowStepKey) => draft.steps.some((s) => s.key === key && s.enabled)
  const runsOcr = enabled('document') && !draft.skipOcr
  const canSave = draft.name.trim() !== '' && draft.steps.some((s) => s.enabled)

  const updateStep = (index: number, update: (step: WorkflowStep) => WorkflowStep) =>
    patch({ steps: draft.steps.map((step, i) => (i === index ? update(step) : step)) })

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= draft.steps.length) return

    const steps = [...draft.steps]
    ;[steps[index], steps[target]] = [steps[target]!, steps[index]!]
    patch({ steps })
  }

  const toggle = (index: number, on: boolean) =>
    updateStep(index, (step) => {
      const seed =
        step.key === 'address' ? DEFAULT_ADDRESS_CONFIG : step.key === 'screening' ? DEFAULT_SCREENING_CONFIG : null

      return { ...step, enabled: on, config: on && seed ? (step.config ?? seed) : step.config }
    })

  const stepWarning = (key: WorkflowStepKey): string | null => {
    if (key === 'face_match' && (!runsOcr || !enabled('liveness'))) {
      return 'Needs document capture with OCR and liveness. Skipped otherwise.'
    }
    if (key === 'screening' && !runsOcr) return 'Needs document capture with OCR. Skipped otherwise.'

    return null
  }

  const signalRelevant = (key: RiskSignalKey): boolean => {
    switch (key) {
      case 'duplicate_face':
        return enabled('liveness')
      case 'underage':
        return runsOcr && draft.minAge !== ''
      case 'pep_match':
      case 'adverse_media':
        return runsOcr && enabled('screening')
      case 'high_risk_network':
      case 'ip_country_mismatch':
      case 'velocity_exceeded':
        return true
      default:
        return runsOcr
    }
  }

  const onSubmit = async () => {
    await send()
    navigate('..', { relative: 'path' })
  }

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit()
      }}
    >
      <div className="flex-1 p-6 lg:p-8">
        <PageHeader
          title={workflow ? `Edit ${workflow.name}` : 'New workflow'}
          description="Choose which checks run, in what order, and how risk signals affect the decision."
          actions={
            <Link to=".." relative="path" className="text-sm text-primary hover:underline">
              ← Workflows
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="pt-6">
                <Field>
                  <FieldLabel htmlFor="workflow-name">Name</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <WorkflowIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="workflow-name"
                      value={draft.name}
                      required
                      autoFocus={!workflow}
                      placeholder="e.g. Standard KYC with screening"
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </InputGroup>
                  <FieldError errors={fieldErrors?.name} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline</CardTitle>
                <CardDescription>Stages run top to bottom. Turn a stage off to skip it.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <PipelinePreview steps={draft.steps} />

                <ol className="flex flex-col gap-2">
                  {draft.steps.map((step, i) => {
                    const stage = STAGE[step.key]
                    const warning = step.enabled ? stepWarning(step.key) : null

                    return (
                      <li
                        key={step.key}
                        className={`rounded-lg border p-3 transition-colors ${
                          step.enabled ? 'border-border bg-card' : 'border-dashed border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                              <ArrowUp className="size-3.5" />
                            </IconButton>
                            <IconButton
                              label="Move down"
                              disabled={i === draft.steps.length - 1}
                              onClick={() => move(i, 1)}
                            >
                              <ArrowDown className="size-3.5" />
                            </IconButton>
                          </div>
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                              step.enabled ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <stage.icon className="size-4" />
                          </span>
                          <label htmlFor={`stage-${step.key}`} className="min-w-0 flex-1 cursor-pointer">
                            <span
                              className={`block text-sm font-medium ${step.enabled ? '' : 'text-muted-foreground'}`}
                            >
                              {stage.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">{stage.description}</span>
                          </label>
                          <Switch
                            id={`stage-${step.key}`}
                            checked={step.enabled}
                            onCheckedChange={(on) => toggle(i, on)}
                            aria-label={`Run ${stage.label}`}
                          />
                        </div>

                        {warning ? <p className="mt-2 pl-[4.25rem] text-xs text-warning">{warning}</p> : null}

                        {step.enabled && step.key === 'address' ? (
                          <StageSettings>
                            <AddressSettings
                              config={addressConfig(step)}
                              onChange={(config) => updateStep(i, (s) => ({ ...s, config }))}
                            />
                          </StageSettings>
                        ) : null}

                        {step.enabled && step.key === 'screening' ? (
                          <StageSettings>
                            <ScreeningSettings
                              config={screeningConfig(step)}
                              onChange={(config) => updateStep(i, (s) => ({ ...s, config }))}
                            />
                          </StageSettings>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
                <FieldError errors={fieldErrors?.steps} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Document</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <SettingRow
                  htmlFor="skip-ocr"
                  title="Skip OCR"
                  description="Capture the document image without reading its data. Turns off face match, screening and document checks."
                >
                  <Switch
                    id="skip-ocr"
                    checked={draft.skipOcr}
                    disabled={!enabled('document')}
                    onCheckedChange={(on) => patch({ skipOcr: on })}
                  />
                </SettingRow>
                <Field>
                  <FieldLabel htmlFor="workflow-min-age">Minimum age</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="workflow-min-age"
                      type="number"
                      min={1}
                      max={120}
                      value={draft.minAge}
                      disabled={!runsOcr}
                      placeholder="No minimum"
                      onChange={(e) => patch({ minAge: e.target.value })}
                    />
                  </InputGroup>
                  <p className="text-xs text-muted-foreground">Younger holders raise the Underage signal.</p>
                  <FieldError errors={fieldErrors?.options} />
                </Field>
              </CardContent>
            </Card>

            <RiskPolicyCard
              policy={draft.riskPolicy}
              relevant={signalRelevant}
              onChange={(riskPolicy) => patch({ riskPolicy })}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur lg:px-8">
        {error && !fieldErrors ? <FieldError>{errorMessage(error, 'Failed to save workflow.')}</FieldError> : null}
        <Button type="button" variant="outline" onClick={() => navigate('..', { relative: 'path' })}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !canSave}>
          {loading ? <Spinner /> : null}
          {workflow ? 'Save changes' : 'Create workflow'}
        </Button>
      </div>
    </form>
  )
}

/** The enabled stages as a left-to-right flow. */
function PipelinePreview({ steps }: { steps: WorkflowStep[] }) {
  const active = steps.filter((step) => step.enabled)

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
      {active.length === 0 ? (
        <span className="text-destructive">Turn on at least one stage.</span>
      ) : (
        active.map((step, i) => (
          <span key={step.key} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
            <span className="rounded bg-background px-2 py-0.5 font-medium shadow-sm">{STAGE[step.key].label}</span>
          </span>
        ))
      )}
    </div>
  )
}

function StageSettings({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:pl-[4.25rem]">{children}</div>
}

function AddressSettings({
  config,
  onChange,
}: {
  config: AddressStepConfig
  onChange: (config: AddressStepConfig) => void
}) {
  const toggleMethod = (method: AddressMethod) =>
    onChange({
      ...config,
      methods: config.methods.includes(method)
        ? config.methods.filter((m) => m !== method)
        : [...config.methods, method],
    })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Methods</span>
        {ADDRESS_METHODS.map((method) => (
          <label key={method} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.methods.includes(method)}
              onChange={() => toggleMethod(method)}
              className="size-4 rounded border-input"
            />
            {ADDRESS_METHOD_LABEL[method]}
          </label>
        ))}
      </div>
      <SettingRow title="When verification fails">
        <SegmentedControl
          label="When address verification fails"
          value={config.on_fail}
          options={[
            { value: 'review', label: 'Review' },
            { value: 'reject', label: 'Reject' },
          ]}
          onChange={(on_fail) => onChange({ ...config, on_fail })}
        />
      </SettingRow>
      <SettingRow
        htmlFor="address-threshold"
        title="Auto-verify at score"
        description="Below this, a passed address goes to review. Blank uses the project threshold."
      >
        <input
          id="address-threshold"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={config.auto_approve_threshold ?? ''}
          placeholder="Project"
          onChange={(e) =>
            onChange({
              ...config,
              auto_approve_threshold: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </SettingRow>
    </>
  )
}

function ScreeningSettings({
  config,
  onChange,
}: {
  config: ScreeningStepConfig
  onChange: (config: ScreeningStepConfig) => void
}) {
  return (
    <>
      <SettingRow
        htmlFor="screening-threshold"
        title="Match threshold"
        description="How close a watchlist entry must be to count as a hit, from 0 to 1."
      >
        <input
          id="screening-threshold"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={config.threshold}
          onChange={(e) => onChange({ ...config, threshold: Number(e.target.value) })}
          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </SettingRow>
      <SettingRow title="On a sanctions hit" description="PEP and adverse media hits follow the risk signals panel.">
        <SegmentedControl
          label="On a sanctions hit"
          value={config.on_hit}
          options={[
            { value: 'review', label: 'Review' },
            { value: 'reject', label: 'Reject' },
          ]}
          onChange={(on_hit) => onChange({ ...config, on_hit })}
        />
      </SettingRow>
      <SettingRow
        htmlFor="screening-monitor"
        title="Ongoing monitoring"
        description="Re-screen verified identities as the lists change."
      >
        <Switch
          id="screening-monitor"
          checked={config.monitor}
          onCheckedChange={(monitor) => onChange({ ...config, monitor })}
        />
      </SettingRow>
    </>
  )
}

function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string
  description?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={htmlFor} className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </label>
      {children}
    </div>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  )
}
