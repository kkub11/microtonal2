const CELL = 44
const GAP = 3
const STEP = CELL + GAP
const GRID_W = 13
const GRID_H = 9
const CX = Math.floor(GRID_W / 2)  // column index of origin
const CY = Math.floor(GRID_H / 2)  // row index of origin (SVG row)

const X_COLOR = '#7c3aed'
const Y_COLOR = '#0891b2'

function pitchHue(pc, edo) {
  return (pc / edo) * 360
}

function pitchFill(pc, edo) {
  return `hsl(${pitchHue(pc, edo)}, 68%, 48%)`
}

function ArrowMarkers() {
  return (
    <defs>
      <marker id="arr-x" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill={X_COLOR} />
      </marker>
      <marker id="arr-y" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill={Y_COLOR} />
      </marker>
    </defs>
  )
}

export default function TonnetzGrid({ edo, xSteps, ySteps, xInterval, yInterval }) {
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

  const svgW = GRID_W * STEP - GAP
  const svgH = GRID_H * STEP - GAP

  // Origin cell position in SVG space (top-left corner of cell)
  const ox = CX * STEP
  const oy = CY * STEP
  // Note centers
  const originCX = ox + CELL / 2
  const originCY = oy + CELL / 2
  // x-neighbor: dx=+1, dy=0 → SVG col CX+1, row CY
  const xNeighborCX = (CX + 1) * STEP + CELL / 2
  // y-neighbor: dy=+1 (lattice up) → SVG row CY-1
  const yNeighborCY = (CY - 1) * STEP + CELL / 2

  const cells = []
  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      const dx = col - CX
      const dy = CY - row  // lattice y increases upward; SVG y increases downward
      const pc = ((dx * xSteps + dy * ySteps) % edo + edo) % edo
      cells.push({ col, row, dx, dy, pc, x: col * STEP, y: row * STEP })
    }
  }

  return (
    <div>
      <svg
        width={svgW}
        height={svgH}
        style={{ display: 'block', overflow: 'visible' }}
        aria-label="Tonnetz grid"
      >
        <ArrowMarkers />

        {/* Cells */}
        {cells.map(({ col, row, dx, dy, pc, x, y }) => {
          const isOrigin = dx === 0 && dy === 0
          const isXNeighbor = dx === 1 && dy === 0
          const isYNeighbor = dx === 0 && dy === 1
          return (
            <g key={`${col}-${row}`}>
              <rect
                x={x} y={y}
                width={CELL} height={CELL}
                rx={5}
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
                x={x + CELL / 2}
                y={y + CELL / 2 + 5}
                textAnchor="middle"
                fontSize={isOrigin ? 14 : 12}
                fontWeight={isOrigin ? 'bold' : 'normal'}
                fill="white"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {pc}
              </text>
            </g>
          )
        })}

        {/* Axis arrows from origin to axis neighbors */}
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

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span style={{ color: X_COLOR }} className="font-medium">
          → {xInterval.ratio[0]}:{xInterval.ratio[1]} = {xSteps} steps
        </span>
        <span style={{ color: Y_COLOR }} className="font-medium">
          ↑ {yInterval.ratio[0]}:{yInterval.ratio[1]} = {ySteps} steps
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          Highlighted border: axis neighbors of pitch class 0
        </span>
      </div>
    </div>
  )
}
