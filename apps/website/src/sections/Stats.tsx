import { useEffect, useRef, useState } from 'react'
import { animate, useInView } from 'motion/react'
import { Container } from '@/components/Container'

const STATS = [
  { to: 10, suffix: '', label: 'Verification states, end to end' },
  { to: 3, suffix: '', label: 'Ways to embed the widget' },
  { to: 1, suffix: '', label: 'Unified API + typed SDK' },
  { to: 100, suffix: '%', label: 'Open-source core' },
]

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setVal(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, to])

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  )
}

export function Stats() {
  return (
    <section className="bg-white pb-24">
      <Container>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white p-8 text-center">
              <div className="text-4xl font-extrabold tracking-tight text-brand-600 tabular-nums">
                <Counter to={s.to} suffix={s.suffix} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
