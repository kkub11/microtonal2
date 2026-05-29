const W = 280, H = 100

export default function PitchHistogram({ histCounts }) {
  if (!histCounts || histCounts.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Histogram appears once annealing starts.
      </p>
    )
  }

  const sorted   = [...histCounts].sort((a, b) => a - b)
  const maxCount = Math.max(...sorted, 1)
  const n        = sorted.length
  const barW     = W / n

  return (
    <div className="space-y-0.5">
      <svg width={W} height={H} className="rounded overflow-visible"
        style={{ background: 'rgb(15 23 42)' }}>
        {sorted.map((count, i) => {
          const bh = (count / maxCount) * (H - 2)
          return (
            <rect
              key={i}
              x={i * barW + 0.25}
              y={H - bh}
              width={Math.max(barW - 0.5, 0.5)}
              height={bh}
              fill="#a78bfa"
            />
          )
        })}
      </svg>
      <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-0.5 select-none">
        <span>pitch class frequency (sorted)</span>
        <span className="font-mono">{n} classes</span>
      </div>
    </div>
  )
}
