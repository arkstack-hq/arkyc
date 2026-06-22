import { ScanLine, ShieldCheck, Workflow } from 'lucide-react'
import { Container } from '@/components/Container'
import { SectionHeading } from '@/components/SectionHeading'
import { RevealGroup, RevealItem } from '@/components/Reveal'

const CARDS = [
  {
    icon: ScanLine,
    title: 'Capture',
    body: 'Guided document and selfie capture through the embeddable widget — overlay, inline, or a hosted page. Live quality hints and auto-capture, themed to your brand.',
  },
  {
    icon: Workflow,
    title: 'Verify',
    body: 'OCR, passive and active liveness, and face match run asynchronously off the request path on a Postgres-backed job queue — swappable provider drivers behind a stable contract.',
  },
  {
    icon: ShieldCheck,
    title: 'Decide',
    body: 'Per-project thresholds turn the signals into a risk score and an automated decision — approved, requires review, or rejected — with a review queue for the edge cases.',
  },
]

export function Capabilities() {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading
          eyebrow="One platform"
          title="Everything between “sign up” and “verified”"
          subtitle="Capture, verify and decide — without stitching together point solutions or building the pipeline yourself."
        />

        <RevealGroup className="mt-14 grid gap-6 md:grid-cols-3">
          {CARDS.map((card) => (
            <RevealItem
              key={card.title}
              className="group rounded-2xl border border-slate-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-950/5"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <card.icon className="size-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold text-ink">{card.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{card.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  )
}
