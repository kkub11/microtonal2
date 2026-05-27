// Maps cost value to a CSS color: green = cheap (consonant), red = expensive (dissonant).
function costColor(cost, min, max) {
  const t = max > min ? (cost - min) / (max - min) : 0
  const r = Math.round(40 + t * 200)
  const g = Math.round(180 - t * 160)
  const b = Math.round(60 - t * 30)
  return `rgb(${r},${g},${b})`
}

export default function CostTable({ costTable, scale, edo }) {
  if (!costTable || !scale || scale.length === 0) return null

  const N = scale.length
  const edoStepCents = 1200 / edo
  const labels = scale.map(s => `${Math.round(s * edoStepCents)}¢`)

  let min = Infinity, max = -Infinity
  for (let k = 0; k < costTable.length; k++) {
    if (costTable[k] < min) min = costTable[k]
    if (costTable[k] > max) max = costTable[k]
  }

  const CELL = 34

  return (
    <div className="space-y-2">
      <div className="flex gap-6 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Min: <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {min.toFixed(2)}
          </span>
        </span>
        <span>
          Max: <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
            {max.toFixed(2)}
          </span>
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          green = consonant · red = dissonant
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ fontSize: 10 }}>
          <thead>
            <tr>
              {/* top-left empty corner */}
              <th style={{ width: 38, height: 28 }} />
              {labels.map((l, j) => (
                <th key={j}
                  style={{ width: CELL, height: 28, padding: '0 2px', textAlign: 'center' }}
                  className="font-mono text-slate-600 dark:text-slate-400 font-medium"
                >
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, i) => (
              <tr key={i}>
                <td
                  style={{ paddingRight: 4, textAlign: 'right', whiteSpace: 'nowrap' }}
                  className="font-mono text-slate-600 dark:text-slate-400 font-medium"
                >
                  {rowLabel}
                </td>
                {scale.map((_, j) => {
                  const cost = costTable[i * N + j]
                  const bg = costColor(cost, min, max)
                  const valStr = cost >= 100 ? Math.round(cost).toString() : cost.toFixed(1)
                  return (
                    <td key={j}
                      title={`${rowLabel} → ${labels[j]}: ${cost.toFixed(3)}`}
                      style={{
                        width: CELL, height: CELL,
                        background: bg,
                        textAlign: 'center',
                        color: 'white',
                        fontFamily: 'monospace',
                        fontSize: 9,
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {valStr}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
