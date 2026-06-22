const CAPABILITIES = [
  'Document capture',
  'OCR',
  'Passive liveness',
  'Active liveness',
  'Face match',
  'Risk scoring',
  'Automated decisioning',
  'Review queue',
  'Signed webhooks',
  'Multi-tenant projects',
  'Audit trail',
  'Embeddable widget',
]

export function Marquee() {
  return (
    <section className="border-y border-slate-200 bg-white py-8">
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
        The whole verification path, in one platform
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee gap-3">
          {[...CAPABILITIES, ...CAPABILITIES].map((cap, i) => (
            <span
              key={`${cap}-${i}`}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600"
            >
              {cap}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
