import EdoSelector from './EdoSelector'
import PrimeSelector from './PrimeSelector'
import TuningErrorTable from './TuningErrorTable'

export default function TuningPanel({ edo, primes, tuningErrors, onEdoChange, onPrimesChange }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Step 1 — Tuning
      </h2>

      {/* EDO + Primes side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <EdoSelector edo={edo} onChange={onEdoChange} />
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <PrimeSelector primes={primes} onChange={onPrimesChange} />
        </div>
      </div>

      {/* Error table */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <TuningErrorTable primes={primes} errors={tuningErrors} />
      </div>
    </div>
  )
}
