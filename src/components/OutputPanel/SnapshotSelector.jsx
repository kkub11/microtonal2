export default function SnapshotSelector({ snapshots, selectedIdx, onChange }) {
  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No snapshots yet — save one from the Compose step.
      </p>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium whitespace-nowrap">Snapshot</label>
      <select
        value={selectedIdx}
        onChange={e => onChange(Number(e.target.value))}
        className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1
                   bg-white dark:bg-slate-800 min-w-0 flex-1 max-w-xs"
      >
        {snapshots.map((s, i) => (
          <option key={s.id} value={i}>
            #{i + 1} — T={s.temperature?.toFixed(1) ?? '?'} cost={
              s.totalCost?.toFixed(0) ?? '?'
            } @ {new Date(s.timestamp).toLocaleTimeString()}
          </option>
        ))}
      </select>
    </div>
  )
}
