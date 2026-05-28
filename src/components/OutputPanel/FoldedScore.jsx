const VOICE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']

export default function FoldedScore({ noteEvents, baseHz = 72, playheadSec = null }) {
  const nonRests = noteEvents.filter(e => !e.isRest && e.freqHz > 0 && e.durationSec > 0)

  if (nonRests.length === 0) {
    return (
      <div className="w-full h-40 flex items-center justify-center text-sm text-slate-400
                      border border-dashed border-slate-300 dark:border-slate-600 rounded">
        No events to display
      </div>
    )
  }

  const W = 800, H = 160
  const totalDur = nonRests.reduce((m, e) => Math.max(m, e.startSec + e.durationSec), 0)
  const xScale = W / totalDur

  const playheadX = (playheadSec != null && totalDur > 0)
    ? Math.min((playheadSec / totalDur) * W, W)
    : null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full border border-slate-200 dark:border-slate-700 rounded bg-slate-900"
      preserveAspectRatio="none"
      aria-label="Folded score — time vs pitch"
    >
      {nonRests.map((e, i) => {
        // Fold frequency into [0, 1) within one octave
        const logRatio = Math.log2(e.freqHz / baseHz)
        const frac = ((logRatio % 1) + 1) % 1
        const y = (1 - frac) * H   // high pitch at top
        const x = e.startSec * xScale
        const w = Math.max(e.durationSec * xScale - 0.5, 0.5)
        const color = VOICE_COLORS[e.voice % VOICE_COLORS.length]
        return (
          <rect key={i} x={x} y={y - 2} width={w} height={4} fill={color} opacity={0.75} />
        )
      })}
      {playheadX != null && (
        <line
          x1={playheadX} y1={0}
          x2={playheadX} y2={H}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={1.5}
        />
      )}
    </svg>
  )
}
