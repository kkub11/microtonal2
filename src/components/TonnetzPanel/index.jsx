import { useMemo } from 'react'
import { getBestApprox } from '../../utils/edoUtils'
import AxisPicker from './AxisPicker'
import TonnetzGrid from './TonnetzGrid'

export default function TonnetzPanel({ edo, primes, xInterval, yInterval, onXChange, onYChange }) {
  const xSteps = useMemo(
    () => getBestApprox(edo, xInterval.ratio[0], xInterval.ratio[1]),
    [edo, xInterval]
  )
  const ySteps = useMemo(
    () => getBestApprox(edo, yInterval.ratio[0], yInterval.ratio[1]),
    [edo, yInterval]
  )

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Step 2 — Tonnetz
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <AxisPicker
            axis="x"
            edo={edo}
            primes={primes}
            value={xInterval}
            onChange={onXChange}
          />
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <AxisPicker
            axis="y"
            edo={edo}
            primes={primes}
            value={yInterval}
            onChange={onYChange}
          />
        </div>
      </div>

      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <TonnetzGrid
          edo={edo}
          xSteps={xSteps}
          ySteps={ySteps}
          xInterval={xInterval}
          yInterval={yInterval}
        />
      </div>
    </div>
  )
}
