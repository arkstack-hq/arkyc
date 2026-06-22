import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ScanFace, ScanLine, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const STAGES = [
  { key: 'document', label: 'Reading document', icon: ScanLine },
  { key: 'liveness', label: 'Liveness check', icon: ScanFace },
  { key: 'face', label: 'Matching face', icon: UserRoundCheck },
  { key: 'done', label: 'Approved', icon: ShieldCheck },
] as const

const CHECKS = ['Document authentic', 'Live person', 'Face match 0.98']

/**
 * A self-running mock of a verification session — cycles document → liveness →
 * face match → approved, with the checklist filling in. Pure decoration.
 */
export function VerificationDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % (STAGES.length + 1))
    }, 1600)
    return () => window.clearInterval(id)
  }, [])

  const done = step >= STAGES.length - 1
  const stage = STAGES[Math.min(step, STAGES.length - 1)]!
  const Icon = stage.icon

  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-brand-500/30 blur-3xl" aria-hidden />

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-5 shadow-2xl shadow-brand-950/40">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-brand-600 text-[11px] font-bold text-white">
              A
            </span>
            <span className="text-sm font-medium text-ink">Verification</span>
          </div>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
              done ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-700',
            )}
          >
            {done ? 'Approved' : 'In progress'}
          </span>
        </div>

        {/* Stage visual */}
        <div className="relative mt-5 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
          {/* Scan sweep */}
          {!done ? (
            <motion.div
              className="absolute inset-x-6 h-px bg-brand-500/70"
              initial={{ top: '20%' }}
              animate={{ top: ['20%', '80%', '20%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          <AnimatePresence mode="wait">
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-2"
            >
              <span
                className={cn(
                  'flex size-14 items-center justify-center rounded-2xl',
                  done ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white',
                )}
              >
                <Icon className="size-7" />
              </span>
              <span className="text-sm font-medium text-slate-600">{stage.label}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Checklist */}
        <ul className="mt-5 flex flex-col gap-2">
          {CHECKS.map((label, i) => {
            const complete = step > i || done
            return (
              <li key={label} className="flex items-center gap-2.5 text-sm">
                <motion.span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full',
                    complete ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-transparent',
                  )}
                  animate={complete ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Check className="size-3" />
                </motion.span>
                <span className={complete ? 'text-ink' : 'text-slate-400'}>{label}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
