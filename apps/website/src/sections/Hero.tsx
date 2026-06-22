import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/Container'
import { ButtonLink, ButtonRoute } from '@/components/Button'
import { VerificationDemo } from '@/components/VerificationDemo'
import { links } from '@/lib/site'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink pt-28 pb-20 text-white sm:pt-32 lg:pb-28">
      {/* Animated gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-24 top-0 size-[34rem] rounded-full bg-brand-600/30 blur-3xl animate-blob" />
        <div className="absolute -right-16 top-24 size-[30rem] rounded-full bg-fuchsia-600/20 blur-3xl animate-blob [animation-delay:-6s]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
      </div>

      <Container className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
          >
            <span className="size-1.5 rounded-full bg-emerald-400" /> Hosted identity verification
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Verify who your users are.
            <br />
            <span className="bg-gradient-to-r from-brand-300 to-fuchsia-300 bg-clip-text text-transparent">
              In minutes, not weeks.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-white/70"
          >
            A beautiful, embeddable flow to capture documents and selfies — then verify end to end with liveness, face
            match and decisioning, or simply hand the captured images off to your own KYC provider. Start free, no sales
            call.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <ButtonLink href={links.signup} variant="brand" size="lg">
              Start free <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonRoute to="/docs" variant="ghostLight" size="lg">
              Read the docs
            </ButtonRoute>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 text-sm text-white/50"
          >
            Open-source core · Self-host it, or let us run it for you.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <VerificationDemo />
        </motion.div>
      </Container>
    </section>
  )
}
