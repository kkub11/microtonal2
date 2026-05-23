import { useMemo } from 'react'
import { monzoToRatio, monzoToCents, commaToTonnetzPath } from '../../utils/commaUtils'
import { getBestApprox } from '../../utils/edoUtils'

const CELL = 36
const GAP = 3
const STEP = CELL + GAP
const PATH_COLOR = '#f59e0b'  // amber — distinct from both axis colors

function pitchFill(pc, edo) {
  return `hsl(${(pc / edo) * 360}, 68%, 48%)`
}

function getPathPositions(moves) {
  const positions = [[0, 0]]
  let x = 0, y = 0
  for (const [dx, dy] of moves) {
    x += dx; y += dy
    positions.push([x, y])
  }
  return positions
}

function MiniTonnetz({ monzo, edo, xInterval, yInterval }) {
  const xSteps = getBestApprox(edo, xInterval.ratio[0], xInterval.ratio[1])
  const ySteps = getBestApprox(edo, yInterval.ratio[0], yInterval.ratio[1])
  const moves = commaToTonnetzPath(monzo, xInterval, yInterval)

  const pathPositions = useMemo(() => getPathPositions(moves), [moves])

  if (moves.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Cannot compute path for this comma with the current axes.
      </p>
    )
  }

  // Bounding box of path positions (including return-to-origin at end)
  const allX = pathPositions.map(p => p[0])
  const allY = pathPositions.map(p => p[1])
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const minY = Math.min(...allY)
  const maxY = Math.max(...allY)

  // Grid with 1-cell margin on each side
  const COLS = maxX - minX + 3
  const ROWS = maxY - minY + 3
  // SVG column for lattice x: col = x - minX + 1
  // SVG row for lattice y (flip): row = maxY - y + 1
  const toSVG = (lx, ly) => ({
    col: lx - minX + 1,
    row: maxY - ly + 1,
  })

  const pathSet = new Map()
  pathPositions.forEach(([x, y], idx) => {
    pathSet.set(`${x},${y}`, idx)
  })

  const svgW = COLS * STEP - GAP
  const svgH = ROWS * STEP - GAP

  // Readable path description
  const rights  = moves.filter(([dx]) => dx > 0).length
  const lefts   = moves.filter(([dx]) => dx < 0).length
  const ups     = moves.filter(([, dy]) => dy > 0).length
  const downs   = moves.filter(([, dy]) => dy < 0).length
  const parts = []
  if (rights) parts.push(`→ ×${rights}`)
  if (lefts)  parts.push(`← ×${lefts}`)
  if (ups)    parts.push(`↑ ×${ups}`)
  if (downs)  parts.push(`↓ ×${downs}`)
  const pathDesc = parts.join('  ')

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        Tonnetz path: <span className="font-medium text-slate-700 dark:text-slate-300">{pathDesc}</span>
      </p>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} style={{ display: 'block' }}>
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: COLS }, (_, col) => {
              // Lattice coords
              const lx = col + minX - 1
              const ly = maxY - row + 1
              const pc = ((lx * xSteps + ly * ySteps) % edo + edo) % edo
              const pathIdx = pathSet.get(`${lx},${ly}`)
              const onPath = pathIdx !== undefined
              const isOrigin = lx === 0 && ly === 0
              const isLast = pathIdx === pathPositions.length - 1
              const x = col * STEP
              const y = row * STEP
              return (
                <g key={`${col}-${row}`}>
                  <rect
                    x={x} y={y} width={CELL} height={CELL} rx={4}
                    fill={pitchFill(pc, edo)}
                    stroke={isOrigin ? '#fff' : onPath ? PATH_COLOR : 'none'}
                    strokeWidth={isOrigin ? 2 : onPath ? 2 : 0}
                    opacity={onPath || isOrigin ? 1 : 0.35}
                  />
                  <text
                    x={x + CELL / 2} y={y + CELL / 2 - (onPath && !isOrigin ? 4 : 0) + 5}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isOrigin ? 'bold' : 'normal'}
                    fill="white"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >{pc}</text>
                  {onPath && !isOrigin && (
                    <text
                      x={x + CELL / 2} y={y + CELL - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill={isLast ? '#fef3c7' : PATH_COLOR}
                      fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{pathIdx}</text>
                  )}
                </g>
              )
            })
          )}
        </svg>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        Numbers show traversal order · fading = off-path
      </p>
    </div>
  )
}

export default function CommaDetail({ comma, edo, xInterval, yInterval }) {
  if (!comma) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Comma Detail
        </label>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Select a comma from the list.
        </p>
      </div>
    )
  }

  const cents = monzoToCents(comma.monzo)
  const { numerator, denominator } = monzoToRatio(comma.monzo)
  const compactRatio =
    numerator <= 999_999_999n && denominator <= 999_999_999n
      ? `${numerator}/${denominator}`
      : null

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        Comma Detail
      </label>

      <dl className="space-y-1.5 text-sm">
        {compactRatio && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-slate-500 dark:text-slate-400">Ratio</dt>
            <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200">{compactRatio}</dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-slate-500 dark:text-slate-400">Cents</dt>
          <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200">
            {cents >= 0 ? '+' : ''}{cents.toFixed(4)}¢
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-slate-500 dark:text-slate-400">Monzo</dt>
          <dd className="font-mono text-xs text-slate-700 dark:text-slate-300 self-center">
            [{comma.monzo.join(' ')}]
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-slate-500 dark:text-slate-400">Best EDO</dt>
          <dd className="font-mono text-slate-800 dark:text-slate-200">{comma.bestEdo}</dd>
        </div>
      </dl>

      <MiniTonnetz
        monzo={comma.monzo}
        edo={edo}
        xInterval={xInterval}
        yInterval={yInterval}
      />
    </div>
  )
}
