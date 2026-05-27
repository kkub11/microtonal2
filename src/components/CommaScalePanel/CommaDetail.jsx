import { useMemo } from 'react'
import { monzoToRatio, monzoToCents, commaToTonnetzPath, commaPathPositions, getCommaName, getCommaProjectionInfo } from '../../utils/commaUtils'
import { getBestApprox } from '../../utils/edoUtils'

const CELL = 36
const GAP = 3
const STEP = CELL + GAP
const PATH_COLOR = '#f59e0b'  // amber — regular path steps
const HOP_COLOR  = '#ef4444'  // red   — hop departure/arrival

function pitchFill(pc, edo) {
  return `hsl(${(pc / edo) * 360}, 68%, 48%)`
}

// Simplest ascending interval name for a hop prime (relative to nearest power of 2).
const HOP_INTERVAL = { 3: '3:2', 5: '5:4', 7: '7:4', 11: '11:8', 13: '13:8' }

function joinPrimes(ps) {
  if (ps.length === 1) return String(ps[0])
  return ps.slice(0, -1).join(', ') + ', and ' + ps[ps.length - 1]
}

function ProjectionWarning({ monzo, xInterval, yInterval }) {
  const { isProjected, extraPrimes, axisPrimes, commaPrimes } = getCommaProjectionInfo(monzo, xInterval, yInterval)
  if (!isProjected) return null

  const planeName = axisPrimes.join(',')
  const hopIntervals = extraPrimes.map(p => HOP_INTERVAL[p] ?? `${p}:…`).join(', ')

  // Suggest alternative two-prime planes from the comma's own primes
  const altPlanes = []
  for (let i = 0; i < commaPrimes.length; i++) {
    for (let j = i + 1; j < commaPrimes.length; j++) {
      const name = `${commaPrimes[i]},${commaPrimes[j]}`
      if (name !== planeName) altPlanes.push(name)
    }
  }

  return (
    <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
      <div>
        This comma involves primes {joinPrimes(commaPrimes)}. You are viewing the{' '}
        <span className="font-semibold">{planeName} plane</span>. Movements along the{' '}
        {hopIntervals} interval{extraPrimes.length > 1 ? 's' : ''} appear as hops (⤳).
      </div>
      {altPlanes.length > 0 && (
        <div>
          Switch to the{' '}
          {altPlanes.map((p, i) => (
            <span key={p}>
              {i > 0 && ' or '}
              <span className="font-semibold">{p} plane</span>
            </span>
          ))}{' '}
          to see those movements continuously.
        </div>
      )}
    </div>
  )
}

function MiniTonnetz({ monzo, edo, xInterval, yInterval }) {
  const xSteps = getBestApprox(edo, xInterval.ratio[0], xInterval.ratio[1])
  const ySteps = getBestApprox(edo, yInterval.ratio[0], yInterval.ratio[1])
  const moves  = useMemo(() => commaToTonnetzPath(monzo, xInterval, yInterval), [monzo, xInterval, yInterval])

  const positions = useMemo(
    () => commaPathPositions(moves, xSteps, ySteps, edo),
    [moves, xSteps, ySteps, edo]
  )

  if (moves.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Cannot compute path for this comma with the current axes.
      </p>
    )
  }

  // Bounding box over all positions (including hop arrivals)
  const allLx = positions.map(p => p.lx)
  const allLy = positions.map(p => p.ly)
  const minX = Math.min(...allLx), maxX = Math.max(...allLx)
  const minY = Math.min(...allLy), maxY = Math.max(...allLy)

  const COLS = maxX - minX + 3
  const ROWS = maxY - minY + 3

  // pathMap: 'lx,ly' → { idx, moveType }
  // hopDepMap: 'lx,ly' → { toPC, prime } for departure cells preceding a hop
  const pathMap   = new Map()
  const hopDepMap = new Map()
  positions.forEach((pos, idx) => {
    const key = `${pos.lx},${pos.ly}`
    if (!pathMap.has(key)) pathMap.set(key, { idx, moveType: pos.moveType })
    if (pos.moveType === 'hop') {
      hopDepMap.set(`${pos.fromLx},${pos.fromLy}`, { toPC: pos.toPC, prime: pos.prime })
    }
  })

  const svgW = COLS * STEP - GAP
  const svgH = ROWS * STEP - GAP

  const axisSteps = moves.filter(m => m.type === 'step')
  const hopMoves  = moves.filter(m => m.type === 'hop')
  const rights = axisSteps.filter(m => m.dx > 0).length
  const lefts  = axisSteps.filter(m => m.dx < 0).length
  const ups    = axisSteps.filter(m => m.dy > 0).length
  const downs  = axisSteps.filter(m => m.dy < 0).length
  const parts = []
  if (rights) parts.push(`→ ×${rights}`)
  if (lefts)  parts.push(`← ×${lefts}`)
  if (ups)    parts.push(`↑ ×${ups}`)
  if (downs)  parts.push(`↓ ×${downs}`)
  if (hopMoves.length) parts.push(`hop ×${hopMoves.length}`)
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
              const lx = col + minX - 1
              const ly = maxY - row + 1
              const pc      = ((lx * xSteps + ly * ySteps) % edo + edo) % edo
              const cellKey = `${lx},${ly}`
              const pathInfo = pathMap.get(cellKey)
              const hopDep   = hopDepMap.get(cellKey)
              const onPath   = pathInfo !== undefined
              const isHopArr = pathInfo?.moveType === 'hop'
              const isOrigin = lx === 0 && ly === 0
              const isLast   = pathInfo?.idx === positions.length - 1
              const x = col * STEP, y = row * STEP

              const borderColor = (hopDep || isHopArr) ? HOP_COLOR
                                : isOrigin ? '#fff'
                                : onPath ? PATH_COLOR
                                : 'none'
              const dashArray = isHopArr ? '3 2' : undefined

              return (
                <g key={`${col}-${row}`}>
                  <rect
                    x={x} y={y} width={CELL} height={CELL} rx={4}
                    fill={pitchFill(pc, edo)}
                    stroke={borderColor}
                    strokeWidth={(hopDep || isHopArr || isOrigin || onPath) ? 2 : 0}
                    strokeDasharray={dashArray}
                    opacity={onPath || hopDep || isOrigin ? 1 : 0.35}
                  />
                  {/* PC number */}
                  <text
                    x={x + CELL / 2}
                    y={y + CELL / 2 - (onPath && !isOrigin && !hopDep ? 4 : 0) + 5}
                    textAnchor="middle" fontSize={11}
                    fontWeight={isOrigin ? 'bold' : 'normal'}
                    fill="white"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >{pc}</text>
                  {/* Traversal order number (regular path cells only) */}
                  {onPath && !isOrigin && !hopDep && (
                    <text
                      x={x + CELL / 2} y={y + CELL - 4}
                      textAnchor="middle" fontSize={9}
                      fill={isLast ? '#fef3c7' : PATH_COLOR} fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >{pathInfo.idx}</text>
                  )}
                  {/* Hop departure: show which prime the hop uses */}
                  {hopDep && (
                    <text
                      x={x + CELL - 2} y={y + 9}
                      textAnchor="end" fontSize={8}
                      fill={HOP_COLOR} fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >→{hopDep.prime}</text>
                  )}
                  {/* Hop arrival marker */}
                  {isHopArr && (
                    <text
                      x={x + 3} y={y + 9}
                      textAnchor="start" fontSize={8}
                      fill={HOP_COLOR} fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >↩</text>
                  )}
                </g>
              )
            })
          )}
        </svg>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        Numbers show traversal order · fading = off-path
        {hopMoves.length > 0 && ' · red border = hop (discontinuous jump)'}
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
  const name = getCommaName(comma.monzo)

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        Comma Detail
      </label>

      <dl className="space-y-1.5 text-sm">
        {name && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-slate-500 dark:text-slate-400">Name</dt>
            <dd className="font-semibold text-violet-700 dark:text-violet-400">{name}</dd>
          </div>
        )}
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

      <ProjectionWarning monzo={comma.monzo} xInterval={xInterval} yInterval={yInterval} />
      <MiniTonnetz
        monzo={comma.monzo}
        edo={edo}
        xInterval={xInterval}
        yInterval={yInterval}
      />
    </div>
  )
}
