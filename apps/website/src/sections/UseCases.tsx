import { ArrowRight, Check, Send, ShieldCheck } from 'lucide-react'
import { Container } from '@/components/Container'
import { SectionHeading } from '@/components/SectionHeading'
import { RevealGroup, RevealItem } from '@/components/Reveal'
import { cn } from '@/lib/utils'

const MODES = [
  {
    icon: ShieldCheck,
    eyebrow: 'End-to-end verification',
    title: 'Let Arkyc decide',
    body: 'Run OCR, liveness and face match and get an automated decision — approved, requires review, or rejected — with a review queue and signed webhooks. Full KYC, in-house.',
    points: ['OCR · liveness · face match', 'Risk scoring + automated decision', 'Review queue + audit trail'],
    best: 'Best for: owning the whole KYC decision',
    accent: false,
  },
  {
    icon: Send,
    eyebrow: 'Capture & hand off',
    title: 'Bring your own provider',
    body: 'Use Arkyc purely for the polished capture experience, then forward the document images and selfie to your existing KYC provider or banking-as-a-service partner. You keep your provider — your users get a flow they’ll actually finish.',
    points: ['Guided, on-brand capture flow', 'Live quality hints + auto-capture', 'Export the captured images & data'],
    best: 'Best for: BaaS or an existing KYC vendor',
    accent: true,
  },
]

export function UseCases() {
  return (
    <section className="bg-white pb-24">
      <Container>
        <SectionHeading
          eyebrow="Flexible by design"
          title="Verify end to end — or just capture and hand off"
          subtitle="Arkyc is the capture layer your users deserve. Run the whole verification, or stop after capture and pass the artifacts to your own provider. Choose per project."
        />

        <RevealGroup className="mt-14 grid gap-6 lg:grid-cols-2">
          {MODES.map((m) => (
            <RevealItem
              key={m.title}
              className={cn(
                'flex flex-col rounded-2xl border p-8 transition-transform duration-300 hover:-translate-y-1',
                m.accent ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-white' : 'border-slate-200 bg-white',
              )}
            >
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-xl',
                  m.accent ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink',
                )}
              >
                <m.icon className="size-6" />
              </span>
              <p className="mt-5 text-sm font-semibold text-brand-600">{m.eyebrow}</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">{m.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{m.body}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {m.points.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-[15px] text-slate-700">
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                      <Check className="size-3.5" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-7 flex items-center gap-2 text-sm font-medium text-slate-500">
                <ArrowRight className="size-4 text-brand-500" />
                {m.best}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  )
}
