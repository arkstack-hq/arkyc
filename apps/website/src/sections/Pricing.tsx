import { Check } from 'lucide-react'
import { Container } from '@/components/Container'
import { SectionHeading } from '@/components/SectionHeading'
import { RevealGroup, RevealItem } from '@/components/Reveal'
import { ButtonLink } from '@/components/Button'
import { links } from '@/lib/site'
import { cn } from '@/lib/utils'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'to start',
    blurb: 'Everything you need to integrate and ship your first verifications.',
    features: ['Embeddable widget + API', 'Free verifications to start', 'Signed webhooks', 'Community support'],
    cta: 'Start free',
    href: links.signup,
    highlight: false,
  },
  {
    name: 'Usage-based',
    price: 'Pay as you go',
    cadence: 'per verification',
    blurb: 'Scale with transparent per-verification pricing. No minimums, no lock-in.',
    features: [
      'Everything in Free',
      'Unlimited projects & members',
      'Review queue + audit trail',
      'Branded widget',
      'Email support',
    ],
    cta: 'Start free',
    href: links.signup,
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'annual',
    blurb: 'For teams with scale, compliance and procurement requirements.',
    features: ['Volume pricing & SLA', 'SSO & dedicated support', 'Self-hosting option', 'Security review & DPA'],
    cta: 'Talk to us',
    href: links.signup,
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="bg-slate-50 py-24">
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Pay for what you verify."
          subtitle="No paywall and no sales call to get going — sign up and integrate today."
        />

        <RevealGroup className="mt-14 grid items-start gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <RevealItem
              key={tier.name}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-white p-7 transition-transform duration-300 hover:-translate-y-1',
                tier.highlight ? 'border-brand-600 shadow-xl shadow-brand-950/10 lg:scale-[1.03]' : 'border-slate-200',
              )}
            >
              {tier.highlight ? (
                <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              ) : null}
              <h3 className="text-lg font-semibold text-ink">{tier.name}</h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-ink">{tier.price}</span>
                <span className="text-sm text-slate-500">{tier.cadence}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{tier.blurb}</p>

              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                      <Check className="size-3.5" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={tier.href}
                variant={tier.highlight ? 'brand' : 'outline'}
                size="lg"
                className="mt-7 w-full"
              >
                {tier.cta}
              </ButtonLink>
            </RevealItem>
          ))}
        </RevealGroup>

        <p className="mt-8 text-center text-sm text-slate-400">
          Illustrative pricing during beta. See the docs for current per-verification rates.
        </p>
      </Container>
    </section>
  )
}
