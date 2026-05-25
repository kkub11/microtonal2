import { useState, useRef, useEffect, useMemo } from 'react'

const CELL = 44
const GAP = 3
const STEP = CELL + GAP

// Standard interval colors matching Jim's blog conventions.
// Keyed by "p:q" where p > q (ascending form).
const INTERVAL_COLORS = {
  '3:2': '#22c55e',   // green  — perfect fifth
  '4:3': '#22c55e',   // green  — perfect fourth
  '5:4': '#3b82f6',   // blue   — major third
  '8:5': '#3b82f6',   // blue   — minor sixth
  '6:5': '#3b82f6',   // blue   — minor third (5-limit)
  '5:3': '#3b82f6',   // blue   — major sixth
  '7:4': '#ef4444',   // red    — harmonic seventh
  '8:7': '#ef4444',   // red
  '7:6': '#ef4444',   // red    — septimal minor third
  '9:7': '#ef4444',   // red
  '7:5': '#ef4444',   // red    — septimal tritone
  '11:8': '#f97316',  // orange — undecimal tritone
  '16:11': '#f97316', // orange
  '11:6': '#f97316',  // orange
  '12:11': '#f97316', // orange
  '13:8': '#a855f7',  // purple — tridecimal major sixth
  '16:13': '#a855f7', // purple
  '13:12': '#a855f7', // purple
  '13:9': '#a855f7',  // purple
}

function intervalColor(ratio) {
  return INTERVAL_COLORS[`${ratio[0]}:${ratio[1]}`] || '#6b7280'
}

function pitchFill(pc, edo) {
  return `hsl(${(pc / edo) * 360}, 68%, 48%)`
}

const btnClass = [
  'px-2 py-1 text-xs font-semibold rounded-md',
  'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  'hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors',
].join(' ')

export default function TonnetzGrid({ edo, xSteps, ySteps, xInterval, yInterval }) {
  const X_COLOR = intervalColor(xInterval.ratio)
  const Y_COLOR = intervalColor(yInterval.ratio)
  const [scale, setScale] = useState(1)
  const containerRef = useRef(null)

  // Grid large enough that the pitch-class repeat pattern is visible.
  // Horizontal period = edo / gcd(edo, xSteps); use edo+4 as a safe upper bound.
  // Cap at 120×70 to keep SVG element count manageable (~8400 cells).
  const COLS = Math.max(25, Math.min(120, edo + 4))
  const ROWS = Math.max(17, Math.min(70, Math.ceil(edo / 2) + 2))
  const CX = Math.floor(COLS / 2)
  const CY = Math.floor(ROWS / 2)

  const svgW = COLS * STEP - GAP
  const svgH = ROWS * STEP - GAP

  const scrollToOrigin = () => {
    const el = containerRef.current
    if (!el) return
    // Origin cell center in scaled pixels
    const cellCX = (CX * STEP + CELL / 2) * scale
    const cellCY = (CY * STEP + CELL / 2) * scale
    el.scrollLeft = cellCX - el.clientWidth / 2
    el.scrollTop = cellCY - el.clientHeight / 2
  }

  // Re-center origin whenever scale or grid dimensions change
  useEffect(() => { scrollToOrigin() }, [scale, CX, CY]) // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const out = []
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const dx = col - CX
        const dy = CY - row  // lattice y increases upward; SVG y increases downward
        const pc = ((dx * xSteps + dy * ySteps) % edo + edo) % edo
        out.push({ col, row, dx, dy, pc, x: col * STEP, y: row * STEP })
      }
    }
    return out
  }, [COLS, ROWS, CX, CY, xSteps, ySteps, edo])

  if (xSteps === 0 || ySteps === 0) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Selected interval maps to 0 steps in {edo}-EDO. Choose a different interval.
      </p>
    )
  }
  if (xSteps === ySteps) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Both axes map to the same step count ({xSteps}). The grid is degenerate — choose different intervals.
      </p>
    )
  }

  // Arrow endpoints in unscaled SVG coordinates
  const originCX = CX * STEP + CELL / 2
  const originCY = CY * STEP + CELL / 2
  const xNeighborCX = (CX + 1) * STEP + CELL / 2
  const yNeighborCY = (CY - 1) * STEP + CELL / 2

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-slate-400">Zoom</span>
        <button
          className={btnClass}
          onClick={() => setScale(s => Math.max(0.25, parseFloat((s - 0.25).toFixed(2))))}
          aria-label="Zoom out"
        >−</button>
        <span className="text-xs w-10 text-center text-slate-600 dark:text-slate-400">
          {Math.round(scale * 100)}%
        </span>
        <button
          className={btnClass}
          onClick={() => setScale(s => Math.min(2, parseFloat((s + 0.25).toFixed(2))))}
          aria-label="Zoom in"
        >+</button>
        <button className={btnClass} onClick={() => setScale(1)}>Reset zoom</button>
        <button className={btnClass} onClick={scrollToOrigin}>Center</button>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {COLS}×{ROWS} cells
        </span>
      </div>

      {/* Scrollable viewport */}
      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700"
        style={{ maxHeight: 420 }}
      >
        {/* SVG width/height encode the scaled render size; viewBox keeps coordinates unscaled */}
        <svg
          width={svgW * scale}
          height={svgH * scale}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block' }}
          aria-label="Tonnetz grid"
        >
          <defs>
            <marker id="arr-x" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill={X_COLOR} />
            </marker>
            <marker id="arr-y" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill={Y_COLOR} />
            </marker>
          </defs>

          {cells.map(({ col, row, dx, dy, pc, x, y }) => {
            const isOrigin = dx === 0 && dy === 0
            const isXNeighbor = dx === 1 && dy === 0
            const isYNeighbor = dx === 0 && dy === 1
            return (
              <g key={`${col}-${row}`}>
                <rect
                  x={x} y={y} width={CELL} height={CELL} rx={5}
                  fill={pitchFill(pc, edo)}
                  stroke={
                    isOrigin ? '#fff'
                    : isXNeighbor ? X_COLOR
                    : isYNeighbor ? Y_COLOR
                    : 'none'
                  }
                  strokeWidth={isOrigin ? 2.5 : (isXNeighbor || isYNeighbor) ? 2 : 0}
                />
                <text
                  x={x + CELL / 2} y={y + CELL / 2 + 5}
                  textAnchor="middle"
                  fontSize={isOrigin ? 14 : 12}
                  fontWeight={isOrigin ? 'bold' : 'normal'}
                  fill="white"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{pc}</text>
              </g>
            )
          })}

          {/* Axis arrows from origin to immediate neighbors */}
          <line
            x1={originCX} y1={originCY}
            x2={xNeighborCX - 12} y2={originCY}
            stroke={X_COLOR} strokeWidth={2.5} strokeOpacity={0.9}
            markerEnd="url(#arr-x)"
          />
          <line
            x1={originCX} y1={originCY}
            x2={originCX} y2={yNeighborCY + 12}
            stroke={Y_COLOR} strokeWidth={2.5} strokeOpacity={0.9}
            markerEnd="url(#arr-y)"
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span style={{ color: X_COLOR }} className="font-medium">
          → {xInterval.ratio[0]}:{xInterval.ratio[1]} = {xSteps} steps
        </span>
        <span style={{ color: Y_COLOR }} className="font-medium">
          ↑ {yInterval.ratio[0]}:{yInterval.ratio[1]} = {ySteps} steps
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          Bordered cells = axis neighbors of pitch class 0
        </span>
      </div>
    </div>
  )
}
