import { ACCESS_CAPABILITIES, type AccessCapability, type PiiCategory, type PiiTiming } from '@arkyc/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { ExtendedAccess, type AccessGrant, type AccessGrantStatus, errorMessage } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { useState } from 'react'

const STATUS: Record<AccessGrantStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted' }> = {
  none: { label: 'Not requested', variant: 'muted' },
  pending: { label: 'Requested', variant: 'warning' },
  granted: { label: 'Granted', variant: 'success' },
  revoked: { label: 'Revoked', variant: 'destructive' },
}

const PII_CATEGORIES: { key: PiiCategory; label: string }[] = [
  { key: 'identity', label: 'Identity (name, date of birth, document number)' },
  { key: 'address', label: 'Address' },
]

export default function ProjectExtendedAccessPage() {
  const organizationId = useOrganizationId()
  const { projectId } = useParams()
  const { can } = useOrganization()
  const canRequest = can('projects.update')

  const {
    data: grants,
    update,
    loading,
    error,
  } = useRequest(ExtendedAccess.status(organizationId, projectId!), {
    immediate: !!projectId,
    initialData: [] as AccessGrant[],
  })

  const [ai, setAi] = useState(false)
  const [pii, setPii] = useState(false)
  const [categories, setCategories] = useState<PiiCategory[]>([])
  const [timing, setTiming] = useState<PiiTiming>('after')
  const [justification, setJustification] = useState('')

  const {
    send,
    loading: submitting,
    error: submitError,
  } = useRequest(
    (capabilities: AccessCapability[]) =>
      ExtendedAccess.request(
        organizationId,
        projectId!,
        capabilities,
        pii ? { categories, timing, justification: justification.trim() } : undefined,
      ),
    { immediate: false },
  ).onSuccess(({ data }) => {
    update({ data })
    setAi(false)
    setPii(false)
    setCategories([])
    setJustification('')
    toast.success('Request sent')
  })

  // Granted capabilities, and ones already awaiting review, can't be requested again.
  const statusOf = (capability: AccessCapability) =>
    grants.find((grant) => grant.capability === capability)?.status ?? 'none'
  const locked = (capability: AccessCapability) => ['granted', 'pending'].includes(statusOf(capability))
  const anyRequestable = !locked('ai') || !locked('pii')

  const piiIncomplete = pii && (categories.length === 0 || justification.trim() === '')
  const canSubmit = canRequest && (ai || pii) && !piiIncomplete && !submitting

  const submit = () => {
    const capabilities = [ai && 'ai', pii && 'pii'].filter(Boolean) as AccessCapability[]
    if (capabilities.length) void send(capabilities)
  }

  const toggleCategory = (key: PiiCategory) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]))

  if (error) return <ErrorState error={error} />
  if (loading && grants.length === 0) return <Loading />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Extended access"
        description="Request gated capabilities for this project. A platform admin reviews and grants each one."
      />

      <Card>
        <CardHeader>
          <CardTitle>Current access</CardTitle>
          <CardDescription>Per-capability status for this project.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {grants.map((grant) => {
            const meta = STATUS[grant.status] ?? STATUS.none

            return (
              <div key={grant.capability} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="text-sm">{ACCESS_CAPABILITIES[grant.capability]?.label ?? grant.capability}</span>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {canRequest && anyRequestable ? (
        <Card>
          <CardHeader>
            <CardTitle>Request access</CardTitle>
            <CardDescription>Choose the capabilities you need. PII access requires extra detail.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CapabilityOption
              label={ACCESS_CAPABILITIES.ai.label}
              description="Higher-accuracy document reads via a vision model."
              status={statusOf('ai')}
              checked={ai}
              onChange={setAi}
            />

            <CapabilityOption
              label={ACCESS_CAPABILITIES.pii.label}
              description="Read the extracted identity/address data back from a session."
              status={statusOf('pii')}
              checked={pii}
              onChange={setPii}
            />

            {pii ? (
              <div className="ml-6 flex flex-col gap-4 border-l border-border pl-4">
                <Field>
                  <FieldLabel>Data you need</FieldLabel>
                  {PII_CATEGORIES.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={categories.includes(c.key)}
                        onChange={() => toggleCategory(c.key)}
                      />
                      {c.label}
                    </label>
                  ))}
                </Field>

                <Field>
                  <FieldLabel htmlFor="pii-timing">When you need it</FieldLabel>
                  <Select id="pii-timing" value={timing} onChange={(e) => setTiming(e.target.value as PiiTiming)}>
                    <option value="after">After the session is verified</option>
                    <option value="before">Before the session is verified</option>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="pii-justification">Justification</FieldLabel>
                  <Textarea
                    id="pii-justification"
                    rows={3}
                    placeholder="How you use this data and how you protect it (storage, retention, access controls)."
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="button" disabled={!canSubmit} onClick={submit}>
                {submitting ? <Spinner /> : null}
                Request access
              </Button>
              {submitError ? <FieldError>{errorMessage(submitError, 'Failed to send request.')}</FieldError> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

/** A requestable capability; greyed out and disabled once granted or awaiting review. */
function CapabilityOption({
  label,
  description,
  status,
  checked,
  onChange,
}: {
  label: string
  description: string
  status: AccessGrantStatus
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const locked = status === 'granted' || status === 'pending'

  return (
    <label className={`flex items-start gap-2 text-sm ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={locked ? false : checked}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>
        <strong>{label}</strong>
        {locked ? (
          <span className="ml-2 text-xs text-muted-foreground">
            {status === 'granted' ? 'Granted' : 'Awaiting review'}
          </span>
        ) : null}
        <span className="block text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}
