const W = 280, H = 100
const T_MIN = 0.1, T_MAX = 100000
const LOG_T_MIN = Math.log(T_MIN)
const LOG_T_MAX = Math.log(T_MAX)

export const N_ENERGY_BUCKETS = 60

export function tempToBucket(T) {
  return Math.min(N_ENERGY_BUCKETS - 1, Math.floor(
    ((Math.log(Math.max(T_MIN, Math.min(T_MAX, T))) - LOG_T_MIN)
      / (LOG_T_MAX - LOG_T_MIN)) * N_ENERGY_BUCKETS
  ))
}

function xOfBucket(i) {
  return ((i + 0.5) / N_ENERGY_BUCKETS) * W
}

function yPos(cost, minC, maxC) {
  const range = maxC - minC || 1
  return H - ((cost - minC) / range) * (H - 4) - 2
}

function xPos(T) {
  return ((Math.log(Math.max(T_MIN, Math.min(T_MAX, T))) - LOG_T_MIN)
    / (LOG_T_MAX - LOG_T_MIN)) * W
}

// Builds SVG path segments through consecutive non-null buckets.
// Gaps (empty buckets) break the line so we don't imply continuity where none exists.
function buildPath(buckets, minC, maxC) {
  let d = ''
  let inSeg = false
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] != null) {
      const x = xOfBucket(i).toFixed(1)
      const y = yPos(buckets[i].cost, minC, maxC).toFixed(1)
      d += inSeg ? ` L ${x},${y}` : ` M ${x},${y}`
      inSeg = true
    } else {
      inSeg = false
    }
  }
  return d.trim()
}

const DECADE_TICKS = [0.1, 1, 10, 100, 1000, 10000, 100000]
const AXIS_LABELS  = [1, 100, 10000]

export default function EnergyDisplay({ progress, energyBuckets }) {
  const { totalCost, iteration } = progress

  const filled   = energyBuckets.filter(Boolean)
  const costs    = filled.map(p => p.cost)
  const minC     = costs.length ? Math.min(...costs) : 0
  const maxC     = costs.length ? Math.max(...costs) : 1
  const pathD    = buildPath(energyBuckets, minC, maxC)

  // Find the most-recently updated bucket to highlight
  const lastBucket = [...energyBuckets].reverse().find(Boolean) ?? null

  return (
    <div className="space-y-2">
      {/* Live readout */}
      <div className="flex gap-5 text-sm font-mono">
        <span>
          <span className="text-slate-500 dark:text-slate-400 font-sans text-xs mr-1">Cost</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {totalCost != null
              ? totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : '—'}
          </span>
        </span>
        <span>
          <span className="text-slate-500 dark:text-slate-400 font-sans text-xs mr-1">Iter</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {iteration ? (iteration / 1000).toFixed(0) + 'k' : '—'}
          </span>
        </span>
      </div>

      {/* Energy graph */}
      {filled.length >= 1 && (
        <div>
          <svg width={W} height={H} className="rounded overflow-visible"
            style={{ background: 'rgb(15 23 42)' }}>
            {/* Decade grid lines */}
            {DECADE_TICKS.map(t => (
              <line key={t}
                x1={xPos(t)} y1={0} x2={xPos(t)} y2={H}
                stroke="rgb(51 65 85)" strokeWidth={1} />
            ))}
            {/* Line through non-null buckets */}
            {pathD && (
              <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth={1.5} />
            )}
            {/* Dot at each bucket with data */}
            {energyBuckets.map((b, i) => b && (
              <circle key={i}
                cx={xOfBucket(i)}
                cy={yPos(b.cost, minC, maxC)}
                r={2} fill="#a78bfa"
              />
            ))}
            {/* Highlight the most recently updated bucket */}
            {lastBucket && (
              <circle
                cx={xPos(lastBucket.temperature)}
                cy={yPos(lastBucket.cost, minC, maxC)}
                r={3.5} fill="none" stroke="#f59e0b" strokeWidth={1.5}
              />
            )}
            {/* Axis labels */}
            {AXIS_LABELS.map(t => (
              <text key={t} x={xPos(t)} y={H - 2}
                textAnchor="middle" fontSize={8} fill="rgb(100 116 139)">
                {t >= 1000 ? (t / 1000) + 'k' : t}
              </text>
            ))}
          </svg>
          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-0.5 select-none">
            <span>cost vs T · latest per region · amber = current</span>
            <span className="font-mono">{filled.length} regions</span>
          </div>
        </div>
      )}

      {filled.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Graph appears once annealing starts.
        </p>
      )}
    </div>
  )
}
