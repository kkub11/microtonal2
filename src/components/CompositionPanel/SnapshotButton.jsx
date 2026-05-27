export default function SnapshotButton({ disabled, onSnapshot }) {
  return (
    <button
      onClick={onSnapshot}
      disabled={disabled}
      title="Save current score state"
      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
    >
      Snapshot
    </button>
  )
}
