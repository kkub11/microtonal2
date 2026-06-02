import { useState, useMemo, useEffect } from 'react'
import { getBestApprox, tonnetzPlanes } from '../../utils/edoUtils'
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

  const numPlanes = useMemo(
    () => tonnetzPlanes(xSteps, ySteps, edo),
    [xSteps, ySteps, edo]
  )
  const [planeOffset, setPlaneOffset] = useState(0)
  useEffect(() => { setPlaneOffset(0) }, [numPlanes])

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
        {numPlanes > 1 && (
          <div className="flex items-center gap-2 mb-3">
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
              ({numPlanes} planes — gcd({xSteps}, {ySteps}, {edo}) = {numPlanes})
            </span>
          </div>
        )}
        <TonnetzGrid
          edo={edo}
          xSteps={xSteps}
          ySteps={ySteps}
          xInterval={xInterval}
          yInterval={yInterval}
          planeOffset={planeOffset}
        />
      </div>
    </div>
  )
}
