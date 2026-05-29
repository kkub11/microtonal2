const W = 280, H = 100
const T_MIN = 0.1, T_MAX = 100000
const LOG_T_MIN = Math.log(T_MIN)
const LOG_T_MAX = Math.log(T_MAX)
const N_BUCKETS  = 50

function xPos(T) {
  return ((Math.log(Math.max(T_MIN, Math.min(T_MAX, T))) - LOG_T_MIN) / (LOG_T_MAX - LOG_T_MIN)) * W
}

function yPos(cost, minC, maxC) {
  const range = maxC - minC || 1
  return H - ((cost - minC) / range) * (H - 4) - 2
}

// Per-temperature-bucket minimum — the nearest approximation to an equilibrium
// curve when the user has been moving the slider non-monotonically.
function lowerEnvelopePath(history, minC, maxC) {
  if (history.length < 2) return ''
  const buckets = new Array(N_BUCKETS).fill(Infinity)
  for (const { temperature, cost } of history) {
    const bi = Math.min(N_BUCKETS - 1, Math.floor(
      ((Math.log(Math.max(T_MIN, Math.min(T_MAX, temperature))) - LOG_T_MIN)
        / (LOG_T_MAX - LOG_T_MIN)) * N_BUCKETS
    ))
    buckets[bi] = Math.min(buckets[bi], cost)
  }
  const pts = []
  for (let i = 0; i < N_BUCKETS; i++) {
    if (buckets[i] < Infinity) {
      const x = ((i + 0.5) / N_BUCKETS) * W
      pts.push(`${x.toFixed(1)},${yPos(buckets[i], minC, maxC).toFixed(1)}`)
    }
  }
  return pts.length < 2 ? '' : 'M ' + pts.join(' L ')
}

const DECADE_TICKS = [0.1, 1, 10, 100, 1000, 10000, 100000]
const AXIS_LABELS  = [1, 100, 10000]

export default function EnergyDisplay({ progress, energyHistory }) {
  const { totalCost, iteration } = progress

  const costs = energyHistory.map(p => p.cost)
  const minC = costs.length ? Math.min(...costs) : 0
  const maxC = costs.length ? Math.max(...costs) : 1
  const envPath = lowerEnvelopePath(energyHistory, minC, maxC)
  const last = energyHistory.length > 0 ? energyHistory[energyHistory.length - 1] : null

  return (
    <div className="space-y-2">
      {/* Live readout */}
      <div className="flex gap-5 text-sm font-mono">
        <span>
          <span className="text-slate-500 dark:text-slate-400 font-sans text-xs mr-1">Cost</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {totalCost != null ? totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
          </span>
        </span>
        <span>
          <span className="text-slate-500 dark:text-slate-400 font-sans text-xs mr-1">Iter</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {iteration ? (iteration / 1000).toFixed(0) + 'k' : '—'}
          </span>
        </span>
      </div>

      {/* Energy graph: scatter + lower envelope */}
      {energyHistory.length >= 2 && (
        <div>
          <svg width={W} height={H} className="rounded overflow-visible"
            style={{ background: 'rgb(15 23 42)' }}>
            {/* Decade grid lines */}
            {DECADE_TICKS.map(t => (
              <line key={t}
                x1={xPos(t)} y1={0} x2={xPos(t)} y2={H}
                stroke="rgb(51 65 85)" strokeWidth={1} />
            ))}
            {/* Scatter dots — all history points */}
            {energyHistory.map(({ temperature, cost }, i) => (
              <circle key={i}
                cx={xPos(temperature)}
                cy={yPos(cost, minC, maxC)}
                r={1.5} fill="#a78bfa" opacity={0.45}
              />
            ))}
            {/* Lower envelope: minimum cost per T bucket */}
            {envPath && (
              <path d={envPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
            )}
            {/* Highlight the most recent sample */}
            {last && (
              <circle
                cx={xPos(last.temperature)}
                cy={yPos(last.cost, minC, maxC)}
                r={3} fill="#a78bfa"
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
            <span>cost vs T · violet: sampled · amber: per-T min</span>
            <span className="font-mono">{energyHistory.length} pts</span>
          </div>
        </div>
      )}

      {energyHistory.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Graph appears once annealing starts.
        </p>
      )}
    </div>
  )
}
