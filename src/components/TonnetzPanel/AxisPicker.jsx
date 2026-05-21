import { useMemo } from 'react'
import { enumerateJustIntervals, getBestApprox } from '../../utils/edoUtils'

export default function AxisPicker({ axis, edo, primes, value, onChange }) {
  const intervals = useMemo(() => enumerateJustIntervals(primes), [primes])

  const selectedKey = `${value.ratio[0]}:${value.ratio[1]}`
  const currentSteps = getBestApprox(edo, value.ratio[0], value.ratio[1])

  const axisLabel = axis === 'x' ? 'X axis →' : 'Y axis ↑'
  const axisColor = axis === 'x' ? 'text-violet-600 dark:text-violet-400' : 'text-cyan-600 dark:text-cyan-400'

  return (
    <div>
      <label className={`block text-sm font-semibold mb-1 ${axisColor}`}>
        {axisLabel}
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        {value.ratio[0]}:{value.ratio[1]} · {currentSteps} steps in {edo}-EDO
      </p>
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
                  ? axis === 'x'
                    ? 'bg-violet-600 text-white'
                    : 'bg-cyan-600 text-white'
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
