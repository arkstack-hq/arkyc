import { useState } from 'react'
import {
  REVIEW_ONLY_RISK_SIGNALS,
  type RiskPolicyConfig,
  type RiskSignalKey,
  type RiskSignalPolicy,
} from '@arkyc/types'
import { RISK_SIGNAL_DESCRIPTION, RISK_SIGNAL_LABEL } from '@/lib/risk'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Preset = 'balanced' | 'strict' | 'relaxed' | 'custom'

const PRESETS: { value: Exclude<Preset, 'custom'>; label: string; description: string; policy: RiskPolicyConfig }[] = [
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Every fraud signal sends the session to a reviewer.',
    policy: {},
  },
  {
    value: 'strict',
    label: 'Strict',
    description: 'Reject reused documents, duplicate faces and underage holders. Review the rest.',
    policy: { duplicate_document: 'reject', duplicate_face: 'reject', underage: 'reject' },
  },
  {
    value: 'relaxed',
    label: 'Relaxed',
    description: 'Ignore weak signals (IP country, repeat sessions, same name). Review the rest.',
    policy: { ip_country_mismatch: 'ignore', velocity_exceeded: 'ignore', duplicate_identity: 'ignore' },
  },
]

/** Signal categories, one tab each. Sanctions hits follow the screening stage, so they aren't listed. */
const CATEGORIES: { value: string; label: string; keys: RiskSignalKey[] }[] = [
  { value: 'duplicates', label: 'Duplicates', keys: ['duplicate_document', 'duplicate_identity', 'duplicate_face'] },
  { value: 'document', label: 'Document', keys: ['document_tampering', 'document_inconsistent', 'underage'] },
  { value: 'screening', label: 'Screening', keys: ['pep_match', 'adverse_media'] },
  { value: 'network', label: 'Network', keys: ['high_risk_network', 'ip_country_mismatch', 'velocity_exceeded'] },
]

const POLICY_OPTIONS: { value: RiskSignalPolicy; label: string }[] = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'review', label: 'Review' },
  { value: 'reject', label: 'Reject' },
]

/** The policy without its `review` entries, which are the default anyway. */
const essential = (policy: RiskPolicyConfig): string =>
  JSON.stringify(
    Object.entries(policy)
      .filter(([, value]) => value !== 'review')
      .sort(([a], [b]) => a.localeCompare(b)),
  )

const presetOf = (policy: RiskPolicyConfig): Preset =>
  PRESETS.find((preset) => essential(preset.policy) === essential(policy))?.value ?? 'custom'

/**
 * How fraud signals affect a session: a preset, or per-signal choices for the
 * signals the workflow can raise.
 */
export function RiskPolicyCard({
  policy,
  relevant,
  onChange,
}: {
  policy: RiskPolicyConfig
  /** Whether the workflow can raise a signal at all. */
  relevant: (key: RiskSignalKey) => boolean
  onChange: (policy: RiskPolicyConfig) => void
}) {
  const [preset, setPreset] = useState<Preset>(() => presetOf(policy))
  const categories = CATEGORIES.map((category) => ({ ...category, keys: category.keys.filter(relevant) })).filter(
    (category) => category.keys.length > 0,
  )

  const choose = (next: Preset) => {
    setPreset(next)
    const match = PRESETS.find((p) => p.value === next)
    if (match) onChange(match.policy)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fraud signals</CardTitle>
        <CardDescription>What happens when a check finds something suspicious.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {[...PRESETS, { value: 'custom' as const, label: 'Custom', description: 'Choose for each signal.' }].map(
          (option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                preset === option.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
              )}
            >
              <input
                type="radio"
                name="risk-preset"
                value={option.value}
                checked={preset === option.value}
                onChange={() => choose(option.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">
                  {option.label}
                  {option.value === 'balanced' ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Recommended</span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ),
        )}

        {preset === 'custom' && categories.length ? (
          <Tabs defaultValue={categories[0]!.value} className="mt-2 border-t border-border pt-3">
            <TabsList className="flex w-full">
              {categories.map((category) => {
                const changed = category.keys.filter((key) => (policy[key] ?? 'review') !== 'review').length

                return (
                  <TabsTrigger key={category.value} value={category.value} className="flex-1">
                    {category.label}
                    {changed ? <span className="text-xs text-primary">{changed}</span> : null}
                  </TabsTrigger>
                )
              })}
            </TabsList>
            {categories.map((category) => (
              <TabsContent key={category.value} value={category.value} className="flex flex-col gap-3">
                {category.keys.map((key) => (
                  <div key={key} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{RISK_SIGNAL_LABEL[key]}</p>
                      <p className="text-xs text-muted-foreground">{RISK_SIGNAL_DESCRIPTION[key]}</p>
                    </div>
                    <SegmentedControl
                      label={RISK_SIGNAL_LABEL[key]}
                      className="shrink-0"
                      value={policy[key] ?? 'review'}
                      options={POLICY_OPTIONS.map((option) =>
                        option.value === 'reject' && REVIEW_ONLY_RISK_SIGNALS.includes(key)
                          ? { ...option, disabled: true, title: 'Too weak a signal to reject on its own' }
                          : option,
                      )}
                      onChange={(value) => onChange({ ...policy, [key]: value })}
                    />
                  </div>
                ))}
              </TabsContent>
            ))}
            <p className="mt-3 text-xs text-muted-foreground">
              Signals your stages can't raise are hidden. Sanctions hits follow the screening stage.
            </p>
          </Tabs>
        ) : null}
      </CardContent>
    </Card>
  )
}
