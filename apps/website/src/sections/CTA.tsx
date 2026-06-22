import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/Container'
import { Reveal } from '@/components/Reveal'
import { ButtonLink, ButtonRoute } from '@/components/Button'
import { links } from '@/lib/site'

export function CTA() {
  return (
    <section className="bg-white pb-24">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center text-white sm:px-16">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -left-10 -top-10 size-72 rounded-full bg-brand-600/40 blur-3xl animate-blob" />
              <div className="absolute -bottom-16 right-0 size-80 rounded-full bg-fuchsia-600/30 blur-3xl animate-blob [animation-delay:-8s]" />
            </div>
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Start verifying your users today
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
                Create a project, drop in the widget, and ship verification this week. Free to start.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href={links.signup} variant="light" size="lg">
                  Start free <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonRoute to="/docs" variant="ghostLight" size="lg">
                  Read the docs
                </ButtonRoute>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
