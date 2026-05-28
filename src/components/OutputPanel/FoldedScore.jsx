import { useState } from 'react'

const VOICE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']
const ZOOM_LEVELS  = [1, 2, 4, 8, 16, 32, 64]
const DEFAULT_ZOOM = 2  // index → 4×

export default function FoldedScore({ noteEvents, baseHz = 72, playheadSec = null }) {
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM)
  const zoom = ZOOM_LEVELS[zoomIdx]

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
  const xScale   = W / totalDur

  const playheadX = (playheadSec != null && totalDur > 0)
    ? Math.min((playheadSec / totalDur) * W, W)
    : null

  const viewWidth = W / zoom
  // Scroll the window to keep the playhead at ~35% from the left edge
  const viewBoxX = playheadX != null
    ? Math.min(Math.max(0, playheadX - viewWidth * 0.35), Math.max(0, W - viewWidth))
    : 0

  return (
    // Fixed height wrapper — prevents SVG from resizing vertically when viewBox width changes
    <div className="relative h-40">
      <svg
        viewBox={`${viewBoxX} 0 ${viewWidth} ${H}`}
        className="absolute inset-0 w-full h-full border border-slate-200 dark:border-slate-700
                   rounded bg-slate-900"
        preserveAspectRatio="none"
        aria-label="Folded score — time vs pitch"
      >
        {nonRests.map((e, i) => {
          const logRatio = Math.log2(e.freqHz / baseHz)
          const frac = ((logRatio % 1) + 1) % 1
          const y     = (1 - frac) * H
          const x     = e.startSec * xScale
          const w     = Math.max(e.durationSec * xScale - 0.5, 0.5)
          const color = VOICE_COLORS[e.voice % VOICE_COLORS.length]
          return (
            <rect key={i} x={x} y={y - 2} width={w} height={4} fill={color} opacity={0.75} />
          )
        })}
        {playheadX != null && (
          <line
            x1={playheadX} y1={0} x2={playheadX} y2={H}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Zoom controls — overlaid on top-right of SVG */}
      <div className="absolute top-1 right-1 flex items-center gap-1">
        <span className="text-xs text-slate-400 tabular-nums select-none mr-0.5">{zoom}×</span>
        <button
          onClick={() => setZoomIdx(i => Math.min(i + 1, ZOOM_LEVELS.length - 1))}
          disabled={zoomIdx === ZOOM_LEVELS.length - 1}
          className="w-6 h-6 flex items-center justify-center rounded text-sm font-bold
                     bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30
                     transition-colors"
          aria-label="Zoom in"
        >+</button>
        <button
          onClick={() => setZoomIdx(i => Math.max(i - 1, 0))}
          disabled={zoomIdx === 0}
          className="w-6 h-6 flex items-center justify-center rounded text-sm font-bold
                     bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30
                     transition-colors"
          aria-label="Zoom out"
        >−</button>
      </div>
    </div>
  )
}
