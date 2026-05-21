const COMMON_EDOS = [12, 19, 22, 31, 41, 53, 72]

export default function EdoSelector({ edo, onChange }) {
  const set = (val) => {
    const n = Math.max(1, Math.min(9999, val))
    if (!isNaN(n)) onChange(n)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Equal Divisions of the Octave
      </label>

      <div className="flex items-center gap-2">
        <button
          onClick={() => set(edo - 1)}
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-base font-medium transition-colors"
          aria-label="Decrease EDO"
        >
          −
        </button>
        <input
          type="number"
          value={edo}
          onChange={(e) => set(parseInt(e.target.value, 10))}
          className="w-16 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          min={1}
          max={9999}
        />
        <button
          onClick={() => set(edo + 1)}
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-base font-medium transition-colors"
          aria-label="Increase EDO"
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className="text-xs text-slate-400 dark:text-slate-500 mr-0.5">Common:</span>
        {COMMON_EDOS.map((e) => (
          <button
            key={e}
            onClick={() => onChange(e)}
            className={[
              'px-2 py-0.5 text-xs rounded-md font-medium transition-colors',
              e === edo
                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
