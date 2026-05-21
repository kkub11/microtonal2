// errorFrac from computeTuningError uses "smaller:larger" key convention,
// where justCents = log2(smaller/larger) < 0 (descending interval).
// We negate so the displayed value follows ascending-interval convention:
// positive = sharp (EDO step overshoots the just ratio), negative = flat.
function ascendingError(entry) {
  return entry ? -entry.errorFrac : null
}

// Both background and text use the same continuous hue so they always agree.
// hue 120 (green) = perfect, hue 0 (red) = half-step off (worst case).
function cellColors(ef) {
  const t = Math.min(Math.abs(ef) / 0.5, 1)
  const hue = Math.round(120 * (1 - t))
  return {
    backgroundColor: `hsla(${hue}, 75%, 50%, 0.14)`,
    color: `hsl(${hue}, 65%, 35%)`,
  }
}

const TH = ({ children }) => (
  <th className="w-16 p-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">
    {children}
  </th>
)

export default function TuningErrorTable({ primes, errors }) {
  // colPrimes = all primes except the last (appear as smaller in a ratio)
  // rowPrimes = all primes except the first (appear as larger)
  const colPrimes = primes.slice(0, -1)
  const rowPrimes = primes.slice(1)

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Tuning Accuracy
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          error in EDO steps &nbsp;(+ = sharp, − = flat; ±0.5 = worst case)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <TH />
              {colPrimes.map((p) => <TH key={p}>{p}</TH>)}
            </tr>
          </thead>
          <tbody>
            {rowPrimes.map((rowP) => (
              <tr key={rowP}>
                <TH>{rowP}</TH>
                {colPrimes.map((colP) => {
                  if (colP >= rowP) {
                    return (
                      <td
                        key={colP}
                        className="w-16 p-2 text-center text-slate-200 dark:text-slate-700"
                      >
                        —
                      </td>
                    )
                  }
                  // computeTuningError key is "smaller:larger"
                  const ef = ascendingError(errors[`${colP}:${rowP}`])
                  if (ef === null) {
                    return <td key={colP} className="w-16 p-2 text-center text-slate-400">?</td>
                  }
                  return (
                    <td
                      key={colP}
                      className="w-16 p-2 text-center font-mono text-xs rounded"
                      style={cellColors(ef)}
                      title={`${rowP}:${colP}  best step: ${errors[`${colP}:${rowP}`].bestStep}`}
                    >
                      {ef >= 0 ? '+' : ''}{ef.toFixed(3)}
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
