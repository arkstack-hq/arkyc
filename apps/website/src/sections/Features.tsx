import { Check } from 'lucide-react'
import { CodeCard } from '@/components/CodeCard'
import { Container } from '@/components/Container'
import type { ReactNode } from 'react'
import { Reveal } from '@/components/Reveal'
import { SectionHeading } from '@/components/SectionHeading'
import { cn } from '@/lib/utils'

interface Feature {
  eyebrow: string
  title: string
  body: string
  points: string[]
  visual: ReactNode
}

const FEATURES: Feature[] = [
  {
    eyebrow: 'Embeddable widget',
    title: 'One widget, embedded your way',
    body: 'Drop the verification flow into your product as an overlay, inline, or a hosted page themed to your brand. Camera capture with quality hints, with a file-upload fallback.',
    points: ['Overlay, inline, or hosted', 'Your colors, logo and radius', 'Mobile-first, accessible flow'],
    visual: (
      <CodeCard
        title="embed.ts"
        code={[
          "import { ArkycWidget } from '@arkyc/sdk/browser'",
          '',
          'ArkycWidget.open({',
          '  token: clientToken,        // from your server',
          '  onComplete: (r) => done(r),',
          '  onError: (e) => show(e),',
          '})',
        ]}
      />
    ),
  },
  {
    eyebrow: 'Decisioning',
    title: 'Decisions you can tune',
    body: 'Each signal document authenticity, OCR confidence, liveness, face match rolls into a risk score and an automated decision. Set the thresholds per project.',
    points: ['Per-project thresholds', 'Swappable provider drivers', 'approved · requires_review · rejected'],
    visual: (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        {[
          ['Document quality', 0.82],
          ['OCR confidence', 0.91],
          ['Liveness', 0.97],
          ['Face match', 0.98],
        ].map(([label, val]) => (
          <div key={label as string} className="mb-4 last:mb-0">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">{label}</span>
              <span className="font-medium tabular-nums text-ink">{val as number}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${(val as number) * 100}%` }} />
            </div>
          </div>
        ))}
        <div className="mt-5 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
          <span className="text-sm font-medium text-emerald-800">Decision</span>
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approved</span>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Reviews',
    title: 'Humans in the loop',
    body: 'Borderline sessions land in a review queue. Approve, reject, request a retry, or leave a note, every is action captured in a tenant-scoped audit trail.',
    points: ['Approve / reject / retry / note', 'Realtime queue updates', 'Full audit log'],
    visual: (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        {[
          ['user_8841', 'Requires review', 'amber'],
          ['user_7720', 'Approved', 'emerald'],
          ['user_6093', 'Rejected', 'rose'],
        ].map(([ref, status, color]) => (
          <div
            key={ref}
            className="flex items-center justify-between border-b border-slate-100 px-2 py-3 last:border-0"
          >
            <span className="font-mono text-sm text-slate-600">{ref}</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
                color === 'amber' && 'bg-amber-100 text-amber-700',
                color === 'emerald' && 'bg-emerald-100 text-emerald-700',
                color === 'rose' && 'bg-rose-100 text-rose-700',
              )}
            >
              {status}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: 'Workflows',
    title: 'Build the flow, including address',
    body: 'Compose verification stages per workflow document, liveness, face match, and an opt-in address stage. Verify a residential address by geocoding it, reverse-geocoding the device location, or a proof-of-address upload, and set the score that auto-verifies.',
    points: [
      'Toggle & reorder stages',
      'Geocode · device location · proof of address',
      'Auto-verify threshold, else review',
    ],
    visual: (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-4 text-sm font-semibold text-ink">Address stage</div>
        {[
          ['Geocode lookup', 'openrouteservice'],
          ['Device location', 'Nominatim / OSM'],
          ['Proof of address', 'manual review'],
        ].map(([label, hint]) => (
          <div key={label} className="mb-3 flex items-center gap-3 last:mb-0">
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
              <Check className="size-3.5" />
            </span>
            <span className="text-sm font-medium text-ink">{label}</span>
            <span className="ml-auto text-xs text-slate-500">{hint}</span>
          </div>
        ))}
        <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-600">Auto-verify at</span>
          <span className="font-semibold tabular-nums text-ink">score ≥ 0.60</span>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Webhooks',
    title: 'Signed webhooks, verified in one call',
    body: 'Every verification event is delivered to your endpoint, HMAC-SHA256 signed, with retries and a deliveries log. Verify the signature with the SDK.',
    points: ['HMAC-SHA256 signatures', 'Automatic retries + deliveries log', 'Per-project endpoints & events'],
    visual: (
      <CodeCard
        title="webhook.ts"
        code={[
          "import { Arkyc } from '@arkyc/sdk'",
          '',
          'const arkyc = new Arkyc({ secretKey })',
          '',
          'const ok = arkyc.webhooks.verify({',
          '  payload',
          '  secret,',
          '  signature,',
          '  timestamp })',
          '})',
          '',
          "if (!ok) throw new Error('bad signature')",
          '',
          'const event = JSON.parse(payload)',
          "if (event.event === 'verification.approved') {",
          '  await activate(event.user_reference)',
          '}',
        ]}
      />
    ),
  },
]

export function Features() {
  return (
    <section id="features" className="bg-slate-50 py-24">
      <Container>
        <SectionHeading
          eyebrow="Built for product teams"
          title="A complete verification stack you don’t have to build"
          subtitle="Server SDK, embeddable widget, decisioning, reviews and webhook wired together and ready to ship."
        />

        <div className="mt-16 flex flex-col gap-20">
          {FEATURES.map((f, i) => {
            const reverse = i % 2 === 1
            return (
              <div key={f.title} className="grid items-center gap-10 lg:grid-cols-2">
                <Reveal className={cn(reverse && 'lg:order-2')}>
                  <p className="text-sm font-semibold text-brand-600">{f.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{f.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{f.body}</p>
                  <ul className="mt-5 flex flex-col gap-2.5">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-2.5 text-[15px] text-slate-700">
                        <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                          <Check className="size-3.5" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={0.1} className={cn(reverse && 'lg:order-1')}>
                  {f.visual}
                </Reveal>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
