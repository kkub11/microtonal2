const DIVISORS = [2, 3, 4, 6, 8]

export default function RhythmSettings({ rhythmSettings, onChange }) {
  const set = key => val => onChange({ ...rhythmSettings, [key]: val })

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500 dark:text-slate-400">Measure length</span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
            {rhythmSettings.measureSec.toFixed(1)} s
          </span>
        </div>
        <input type="range" min={1} max={20} step={0.5} value={rhythmSettings.measureSec}
          onChange={e => set('measureSec')(Number(e.target.value))}
          className="w-full accent-violet-600"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
          Notes per measure
        </label>
        <div className="flex gap-1.5">
          {DIVISORS.map(d => (
            <button key={d}
              onClick={() => set('divisor')(d)}
              className={[
                'w-9 h-8 text-sm font-semibold rounded-md transition-colors',
                d === rhythmSettings.divisor
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
