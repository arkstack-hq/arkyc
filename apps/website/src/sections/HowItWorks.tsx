import { RevealGroup, RevealItem } from '@/components/Reveal'

import { Container } from '@/components/Container'
import { SectionHeading } from '@/components/SectionHeading'

const STEPS = [
  {
    n: '01',
    title: 'Create a project',
    body: 'Spin up a project in the dashboard and grab your secret + publishable API keys.',
  },
  {
    n: '02',
    title: 'Start a session',
    body: 'Call arkyc.sessions.create() server-side with @arkyc/sdk and hand the client token to your frontend.',
  },
  {
    n: '03',
    title: 'Embed the widget',
    body: 'Open the widget with that token, the user completes document capture, liveness and selfie.',
  },
  {
    n: '04',
    title: 'Get the decision',
    body: 'Receive the decision via signed webhook and in the dashboard; review the edge cases in the queue.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="bg-white py-24">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="Live in four steps"
          subtitle="From zero to your first verified user in an afternoon — no pipeline to build."
        />

        <RevealGroup className="relative mt-16 grid gap-8 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-slate-200 md:block" aria-hidden />
          {STEPS.map((step) => (
            <RevealItem key={step.n} className="relative">
              <span className="relative z-10 flex size-12 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
                {step.n}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{step.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  )
}
