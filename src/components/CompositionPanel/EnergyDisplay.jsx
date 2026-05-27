const W = 280, H = 100
const T_MIN = 0.1, T_MAX = 1000
const LOG_T_MIN = Math.log(T_MIN)
const LOG_T_MAX = Math.log(T_MAX)

function xPos(T) {
  const clamped = Math.max(T_MIN, Math.min(T_MAX, T))
  return ((Math.log(clamped) - LOG_T_MIN) / (LOG_T_MAX - LOG_T_MIN)) * W
}

function buildPath(history, minC, maxC) {
  if (history.length < 2) return ''
  const range = maxC - minC || 1
  const pts = history.map(({ temperature, cost }) => {
    const x = xPos(temperature)
    const y = H - ((cost - minC) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return 'M ' + pts.join(' L ')
}

export default function EnergyDisplay({ progress, energyHistory }) {
  const { totalCost, iteration } = progress

  const costs = energyHistory.map(p => p.cost)
  const minC = costs.length ? Math.min(...costs) : 0
  const maxC = costs.length ? Math.max(...costs) : 1
  const pathD = buildPath(energyHistory, minC, maxC)

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

      {/* Energy graph: cost vs T (log scale) */}
      {energyHistory.length >= 2 && (
        <div>
          <svg width={W} height={H} className="rounded overflow-visible"
            style={{ background: 'rgb(15 23 42)' }}>  {/* slate-900 */}
            {/* Axis ticks for T */}
            {[0.1, 1, 10, 100, 1000].map(t => (
              <line key={t}
                x1={xPos(t)} y1={0} x2={xPos(t)} y2={H}
                stroke="rgb(51 65 85)" strokeWidth={1} />   /* slate-700 */
            ))}
            {/* Data path */}
            <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth={1.5} />
            {/* Axis labels */}
            {[1, 10, 100].map(t => (
              <text key={t} x={xPos(t)} y={H - 2}
                textAnchor="middle" fontSize={8} fill="rgb(100 116 139)">
                {t}
              </text>
            ))}
          </svg>
          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-0.5 select-none">
            <span>cost vs T (log scale)</span>
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
