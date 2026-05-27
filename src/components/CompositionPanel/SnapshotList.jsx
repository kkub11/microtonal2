export default function SnapshotList({ snapshots }) {
  if (!snapshots || snapshots.length === 0) return null

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Snapshots ({snapshots.length})
      </label>
      <div className="space-y-1.5">
        {snapshots.map((snap, i) => {
          const shape = snap.scoreShape ?? []
          const total = shape.reduce((a, b) => a * b, 1)
          return (
            <div key={snap.id ?? i}
              className="flex items-center gap-4 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
            >
              <span className="text-slate-400 dark:text-slate-500">#{i + 1}</span>
              <span className="text-violet-600 dark:text-violet-400 font-semibold">
                T = {snap.temperature < 10
                  ? snap.temperature.toFixed(2)
                  : snap.temperature < 100
                  ? snap.temperature.toFixed(1)
                  : snap.temperature.toFixed(0)}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                cost {snap.totalCost?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                {shape.join('×')}
                {total ? ` (${total.toLocaleString()} notes)` : ''}
              </span>
              <span className="text-slate-400 dark:text-slate-500 ml-auto">
                {snap.timestamp
                  ? new Date(snap.timestamp).toLocaleTimeString()
                  : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
