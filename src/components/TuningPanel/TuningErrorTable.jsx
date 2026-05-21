// hue 120 (green) = perfect, hue 0 (red) = 0.5 steps off (worst case)
function cellColors(error) {
  const t = Math.min(error / 0.5, 1)
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
  // colPrimes = smaller prime (denominator of ascending ratio)
  // rowPrimes = larger prime (numerator of ascending ratio)
  const colPrimes = primes.slice(0, -1)
  const rowPrimes = primes.slice(1)

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Tuning Accuracy
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          error in EDO steps &nbsp;(0 = perfect, 0.5 = worst case)
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
                      <td key={colP} className="w-16 p-2 text-center text-slate-200 dark:text-slate-700">
                        —
                      </td>
                    )
                  }
                  // errors[hi][lo] — direct lookup, no sign manipulation needed
                  const error = errors[rowP]?.[colP]
                  if (error == null) {
                    return <td key={colP} className="w-16 p-2 text-center text-slate-400">?</td>
                  }
                  return (
                    <td
                      key={colP}
                      className="w-16 p-2 text-center font-mono text-xs rounded"
                      style={cellColors(error)}
                      title={`${rowP}:${colP}`}
                    >
                      {error.toFixed(3)}
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
