import { AnimatePresence, motion } from 'motion/react'

import { Container } from '@/components/Container'
import { Plus } from 'lucide-react'
import { SectionHeading } from '@/components/SectionHeading'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const FAQS = [
  {
    q: 'What is Arkyc?',
    a: 'Arkyc is hosted identity verification. You create a session, embed our widget, and your user completes document capture, liveness and a selfie. We run OCR, liveness and face match, score the risk, and return an automated decision with a review queue and signed webhooks.',
  },
  {
    q: 'Can I use my own KYC provider?',
    a: 'Yes, run Arkyc capture-only. Your users complete the polished document and selfie flow, and you hand the captured images and data off to your existing KYC provider or banking-as-a-service partner. Or let Arkyc verify end to end. You choose per project.',
  },
  {
    q: 'How long does integration take?',
    a: 'Most teams are live in an afternoon: create a project, call sessions.create() with the SDK, open the widget with the client token, and handle a single webhook. No verification pipeline to build.',
  },
  {
    q: 'Can I self-host instead?',
    a: 'Yes. Arkyc has an open-source core, the hosted product is the same engine we run for you. If you’d rather operate it yourself, the project documentation covers self-hosting and white-labeling.',
  },
  {
    q: 'How does billing work?',
    a: 'Usage-based: you pay per verification, with a free tier to start and no minimums. Enterprise plans add volume pricing, an SLA and dedicated support.',
  },
  {
    q: 'Do you support webhooks?',
    a: 'Every verification event is delivered to your endpoint, HMAC-SHA256 signed, with automatic retries and a deliveries log. Verify the signature in one call with @arkyc/sdk.',
  },
  {
    q: 'How is my users’ data handled?',
    a: 'You control which projects exist, who can access them, and retention with a full audit trail of every action taken in the dashboard.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="bg-white py-24">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />

        <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q}>
                <button
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="text-[17px] font-medium text-ink">{item.q}</span>
                  <Plus
                    className={cn(
                      'size-5 shrink-0 text-slate-400 transition-transform duration-300',
                      isOpen && 'rotate-45 text-brand-600',
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-[15px] leading-relaxed text-slate-600">{item.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
