import { Hero } from '@/sections/Hero'
import { Marquee } from '@/sections/Marquee'
import { Capabilities } from '@/sections/Capabilities'
import { UseCases } from '@/sections/UseCases'
import { Features } from '@/sections/Features'
import { HowItWorks } from '@/sections/HowItWorks'
import { Stats } from '@/sections/Stats'
import { Pricing } from '@/sections/Pricing'
import { FAQ } from '@/sections/FAQ'
import { CTA } from '@/sections/CTA'

export function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Capabilities />
      <UseCases />
      <Features />
      <HowItWorks />
      <Stats />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  )
}
