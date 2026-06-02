import { useState, useMemo, useEffect } from 'react'
import { getBestApprox, enumerateJustIntervals, tonnetzPlanes } from '../../utils/edoUtils'
import { commaToTonnetzPath, commaPathPositions, getCommaProjectionInfo } from '../../utils/commaUtils'
import { findMOSSizes, buildScaleFromGenerator } from '../../utils/scaleUtils'

const CELL = 32
const GAP = 2
const STEP = CELL + GAP
const MAN_COLS = 15
const MAN_ROWS = 9

function pitchFill(pc, edo) {
  return `hsl(${(pc / edo) * 360}, 68%, 48%)`
}

// Returns { cells, hopDep, hopArr } for path rendering in InteractiveTonnetz.
// hopDep: Map 'lx,ly' → { toPC, prime }; hopArr: Set 'lx,ly'
function buildPathData(moves, xSteps, ySteps, edo) {
  const cells  = new Set()
  const hopDep = new Map()
  const hopArr = new Set()
  if (!moves || moves.length === 0) return { cells, hopDep, hopArr }
  const positions = commaPathPositions(moves, xSteps, ySteps, edo)
  positions.forEach(pos => {
    cells.add(`${pos.lx},${pos.ly}`)
    if (pos.moveType === 'hop') {
      hopDep.set(`${pos.fromLx},${pos.fromLy}`, { toPC: pos.toPC, prime: pos.prime })
      hopArr.add(`${pos.lx},${pos.ly}`)
    }
  })
  return { cells, hopDep, hopArr }
}

function computeScaleMetrics(scale, edo) {
  if (!scale || scale.length < 2) return null
  const stepCents = scale.map((p, i) => {
    const next = scale[(i + 1) % scale.length]
    return ((next - p + edo) % edo) / edo * 1200
  })
  const min = Math.min(...stepCents)
  const max = Math.max(...stepCents)
  return { stepCents, min, max, ratio: max / min }
}

function ScaleMetrics({ scale, edo }) {
  const m = computeScaleMetrics(scale, edo)
  if (!m) return null
  const ratioFlag = m.ratio > 3
  const tinyFlag = m.min < 50
  return (
    <div className="text-xs space-y-0.5">
      <div className="flex flex-wrap gap-3">
        <span className="text-slate-500 dark:text-slate-400">
          Min: <span className={`font-mono font-semibold ${tinyFlag ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {m.min.toFixed(1)}¢
          </span>
          {tinyFlag && ' ⚠ <50¢'}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          Max: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{m.max.toFixed(1)}¢</span>
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          Ratio: <span className={`font-mono font-semibold ${ratioFlag ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {m.ratio.toFixed(2)}
          </span>
          {ratioFlag && ' ⚠ >3:1'}
        </span>
      </div>
      <div className="font-mono text-slate-500 dark:text-slate-400">
        Steps: {m.stepCents.map(c => c.toFixed(0) + '¢').join('  ')}
      </div>
    </div>
  )
}

function nonOctavePrimeCount(monzo) {
  let count = 0
  for (let i = 1; i < monzo.length; i++) {
    if (monzo[i] !== 0) count++
  }
  return count
}

// ─── Scale ruler ────────────────────────────────────────────────────────────

function ScaleRuler({ scale, edo }) {
  const W = 260, H = 20
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <rect x={0} y={6} width={W} height={8} rx={2} fill="#e2e8f0" />
      {scale.map((step, i) => (
        <rect key={i}
          x={Math.round(step / edo * (W - 3)) + 1}
          y={3} width={3} height={14}
          fill="#7c3aed" rx={1}
        />
      ))}
    </svg>
  )
}

// ─── Auto mode ──────────────────────────────────────────────────────────────

function GeneratorPicker({ edo, primes, value, onChange }) {
  const intervals = useMemo(() => enumerateJustIntervals(primes), [primes])
  const selectedKey = `${value.ratio[0]}:${value.ratio[1]}`

  return (
    <div>
      <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
        Generator interval
      </label>
      <div className="flex flex-wrap gap-1.5">
        {intervals.map(({ ratio, name, cents }) => {
          const steps = getBestApprox(edo, ratio[0], ratio[1])
          const key = `${ratio[0]}:${ratio[1]}`
          const selected = key === selectedKey
          return (
            <button
              key={key}
              onClick={() => onChange({ ratio })}
              title={`${name} · ${cents.toFixed(1)}¢ · ${steps} steps`}
              className={[
                'px-2 py-1 text-xs font-semibold rounded-md transition-colors',
                selected
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              {ratio[0]}:{ratio[1]}
              <span className="ml-1 opacity-70 font-normal">{steps}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AutoMode({ edo, primes, defaultGenerator, onSelect }) {
  const [generator, setGenerator] = useState(defaultGenerator)
  const [pickedSize, setPickedSize] = useState(null)

  const genSteps = useMemo(
    () => getBestApprox(edo, generator.ratio[0], generator.ratio[1]),
    [edo, generator]
  )

  const mosSizes = useMemo(
    () => findMOSSizes(edo, genSteps),
    [edo, genSteps]
  )

  const scale = useMemo(
    () => pickedSize != null ? buildScaleFromGenerator(edo, genSteps, pickedSize) : null,
    [edo, genSteps, pickedSize]
  )

  return (
    <div className="space-y-4">
      <GeneratorPicker
        edo={edo} primes={primes} value={generator}
        onChange={(g) => { setGenerator(g); setPickedSize(null) }}
      />

      <div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
          Scale sizes (MOS) · {mosSizes.length} found for {genSteps}-step generator
        </p>
        {mosSizes.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No MOS scales for this generator and EDO.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {mosSizes.map(n => (
              <button
                key={n}
                onClick={() => setPickedSize(n)}
                className={[
                  'px-2.5 py-1 text-sm font-semibold rounded-md transition-colors',
                  n === pickedSize
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {scale && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {scale.length}-note scale preview
          </p>
          <ScaleRuler scale={scale} edo={edo} />
          <ScaleMetrics scale={scale} edo={edo} />
          <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
            [{scale.join(', ')}]
          </p>
          <button
            onClick={() => onSelect(scale)}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Use this scale
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Manual mode ────────────────────────────────────────────────────────────

function InteractiveTonnetz({ edo, xInterval, yInterval, comma, selectedPCs, onToggle, planeOffset = 0 }) {
  const xSteps = getBestApprox(edo, xInterval.ratio[0], xInterval.ratio[1])
  const ySteps = getBestApprox(edo, yInterval.ratio[0], yInterval.ratio[1])

  const pathData = useMemo(() => {
    if (!comma) return { cells: new Set(), hopDep: new Map(), hopArr: new Set() }
    const moves = commaToTonnetzPath(comma.monzo, xInterval, yInterval)
    return buildPathData(moves, xSteps, ySteps, edo)
  }, [comma, xInterval, yInterval, xSteps, ySteps, edo])

  const originCol = Math.floor(MAN_COLS / 2)
  const originRow = Math.floor(MAN_ROWS / 2)
  const svgW = MAN_COLS * STEP - GAP
  const svgH = MAN_ROWS * STEP - GAP

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {Array.from({ length: MAN_ROWS }, (_, row) =>
          Array.from({ length: MAN_COLS }, (_, col) => {
            const lx = col - originCol
            const ly = originRow - row
            const pc       = ((lx * xSteps + ly * ySteps + planeOffset) % edo + edo) % edo
            const cellKey  = `${lx},${ly}`
            const onPath   = pathData.cells.has(cellKey)
            const hopDep   = pathData.hopDep.get(cellKey)
            const isHopArr = pathData.hopArr.has(cellKey)
            const isSelected = selectedPCs.has(pc)
            const isOrigin = lx === 0 && ly === 0
            const x = col * STEP, y = row * STEP

            const borderColor = isSelected ? '#f59e0b'
                              : (hopDep || isHopArr) ? '#ef4444'
                              : onPath ? '#f59e0b'
                              : isOrigin ? '#fff'
                              : 'none'
            const dashArray = isHopArr ? '3 2' : undefined

            return (
              <g key={`${col}-${row}`} style={{ cursor: 'pointer' }} onClick={() => onToggle(pc)}>
                <rect
                  x={x} y={y} width={CELL} height={CELL} rx={3}
                  fill={isSelected ? '#d97706' : pitchFill(pc, edo)}
                  stroke={borderColor}
                  strokeWidth={isSelected ? 2 : (hopDep || isHopArr || onPath) ? 1.5 : isOrigin ? 2 : 0}
                  strokeDasharray={dashArray}
                  opacity={isSelected || onPath || hopDep || isOrigin ? 1 : 0.4}
                />
                <text
                  x={x + CELL / 2} y={y + CELL / 2 + 4}
                  textAnchor="middle" fontSize={10}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  fill="white"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{pc}</text>
                {hopDep && (
                  <text
                    x={x + CELL - 1} y={y + 8}
                    textAnchor="end" fontSize={7}
                    fill="#ef4444" fontWeight="bold"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >→{hopDep.prime}</text>
                )}
                {isHopArr && (
                  <text
                    x={x + 2} y={y + 8}
                    textAnchor="start" fontSize={7}
                    fill="#ef4444" fontWeight="bold"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >↩</text>
                )}
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}

function ManualMode({ edo, xInterval, yInterval, comma, onSelect, onYIntervalChange }) {
  const [selectedPCs, setSelectedPCs] = useState(new Set())
  const xSteps = getBestApprox(edo, xInterval.ratio[0], xInterval.ratio[1])
  const ySteps = getBestApprox(edo, yInterval.ratio[0], yInterval.ratio[1])
  const numPlanes = useMemo(() => tonnetzPlanes(xSteps, ySteps, edo), [xSteps, ySteps, edo])
  const [planeOffset, setPlaneOffset] = useState(0)
  useEffect(() => { setPlaneOffset(0) }, [numPlanes])

  function togglePC(pc) {
    setSelectedPCs(prev => {
      const next = new Set(prev)
      if (next.has(pc)) next.delete(pc)
      else next.add(pc)
      return next
    })
  }

  const scale = useMemo(
    () => Array.from(selectedPCs).sort((a, b) => a - b),
    [selectedPCs]
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Click cells to toggle pitch classes into the scale.
        {comma && ' Amber border = comma traversal path.'}
      </p>

      {comma && (() => {
        const { isProjected, extraPrimes, axisPrimes, commaPrimes } = getCommaProjectionInfo(comma.monzo, xInterval, yInterval)
        if (!isProjected) return null
        const PRIME_INTERVAL = { 3: [3,2], 5: [5,4], 7: [7,4], 11: [11,8], 13: [13,8] }
        const HOP_NAME = { 3: '3:2', 5: '5:4', 7: '7:4', 11: '11:8', 13: '13:8' }
        const planeName = axisPrimes.join(',')
        const hopIntervals = extraPrimes.map(p => HOP_NAME[p] ?? `${p}:…`).join(', ')
        const allPrimesStr = commaPrimes.length <= 2 ? commaPrimes.join(' and ')
          : commaPrimes.slice(0, -1).join(', ') + ', and ' + commaPrimes[commaPrimes.length - 1]
        const xPrime = (() => { for (const p of [13,11,7,5,3]) if (xInterval.ratio[0]%p===0||xInterval.ratio[1]%p===0) return p; return null })()
        return (
          <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
            <div>
              This comma involves primes {allPrimesStr}. You are viewing the{' '}
              <span className="font-semibold">{planeName} plane</span>. Movements along the{' '}
              {hopIntervals} interval{extraPrimes.length > 1 ? 's' : ''} appear as hops (⤳).
            </div>
            {onYIntervalChange && extraPrimes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {extraPrimes.map(p => {
                  const ratio = PRIME_INTERVAL[p]
                  if (!ratio) return null
                  return (
                    <button key={p}
                      onClick={() => onYIntervalChange({ ratio })}
                      className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 font-semibold transition-colors"
                    >
                      View {xPrime},{p} plane
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {numPlanes > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Plane</span>
          <select
            value={planeOffset}
            onChange={e => setPlaneOffset(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            {Array.from({ length: numPlanes }, (_, k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ({numPlanes} planes)
          </span>
        </div>
      )}
      <InteractiveTonnetz
        edo={edo} xInterval={xInterval} yInterval={yInterval}
        comma={comma} selectedPCs={selectedPCs} onToggle={togglePC}
        planeOffset={planeOffset}
      />

      {scale.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {scale.length} pitch class{scale.length !== 1 ? 'es' : ''} selected
          </p>
          <ScaleRuler scale={scale} edo={edo} />
          <ScaleMetrics scale={scale} edo={edo} />
          <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
            [{scale.join(', ')}]
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPCs(new Set())}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => onSelect(scale)}
              className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Use this scale
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No pitch classes selected yet.
        </p>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ScaleBuilder({ comma, edo, primes, xInterval, yInterval, scale, onScaleChange, onYIntervalChange }) {
  const suggestedMode = !comma || nonOctavePrimeCount(comma.monzo) <= 2 ? 'auto' : 'manual'
  const [mode, setMode] = useState(suggestedMode)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Scale Builder
        </label>
        <div className="flex gap-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
          {['auto', 'manual'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                mode === m
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              ].join(' ')}
            >
              {m === 'auto' ? 'Auto' : 'Manual'}
              {m === suggestedMode && (
                <span className="ml-1 text-amber-500">·</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {scale && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Scale set: {scale.length} notes — [{scale.join(', ')}]
          </p>
        </div>
      )}

      {mode === 'auto' ? (
        <AutoMode
          key={`auto-${edo}-${primes.join(',')}`}
          edo={edo} primes={primes} defaultGenerator={xInterval}
          onSelect={onScaleChange}
        />
      ) : (
        <ManualMode
          key={`manual-${comma?.monzo.join(',') ?? 'none'}-${edo}`}
          edo={edo} xInterval={xInterval} yInterval={yInterval}
          comma={comma} onSelect={onScaleChange} onYIntervalChange={onYIntervalChange}
        />
      )}
    </div>
  )
}
