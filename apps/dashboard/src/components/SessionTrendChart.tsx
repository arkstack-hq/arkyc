import { useId, useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** New sessions per day, as a single-series area chart with a hover tooltip. */
export function SessionTrendChart({
  trend,
  height = 'h-64',
}: {
  trend: { date: string; count: number }[]
  height?: string
}) {
  const gradient = useId().replace(/:/g, '')
  const data = useMemo(() => trend.map((d) => ({ label: fmtDay(d.date), count: d.count })), [trend])

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)' }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Sessions"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill={`url(#${gradient})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
