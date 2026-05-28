const SIMPLE_DIVISORS   = [2, 3, 4, 6, 8]
const FULL_DIVISORS     = [2, 3, 4, 5]

function Slider({ label, hint, min, max, step, value, onChange, fmt }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
          {fmt ? fmt(value) : value}
        </span>
      </div>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{hint}</p>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-violet-600"
      />
    </div>
  )
}

export default function RhythmSettings({ rhythmSettings, onChange }) {
  const rs  = rhythmSettings
  const set = key => val => onChange({ ...rs, [key]: val })

  function toggleDivisor(d) {
    const current = rs.allowedDivisors
    const next    = current.includes(d) ? current.filter(x => x !== d) : [...current, d].sort((a, b) => a - b)
    if (next.length === 0) return  // always keep at least one
    onChange({ ...rs, allowedDivisors: next })
  }

  return (
    <div className="space-y-4">

      {/* ── Mode toggle ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Rhythm mode</span>
        <div className="flex rounded overflow-hidden border border-slate-300 dark:border-slate-600">
          {['simple', 'full'].map(m => (
            <button
              key={m}
              onClick={() => set('mode')(m)}
              className={[
                'px-3 py-1 text-sm capitalize transition-colors',
                rs.mode === m
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Measure duration (both modes) ─────────────────────────────────── */}
      <Slider
        label="Measure length"
        min={1} max={30} step={0.5}
        value={rs.measureSec}
        onChange={set('measureSec')}
        fmt={v => `${v.toFixed(1)} s`}
      />

      {/* ── Simple mode ───────────────────────────────────────────────────── */}
      {rs.mode === 'simple' && (
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            Notes per measure
          </label>
          <div className="flex gap-1.5">
            {SIMPLE_DIVISORS.map(d => (
              <button key={d}
                onClick={() => set('divisor')(d)}
                className={[
                  'w-9 h-8 text-sm font-semibold rounded-md transition-colors',
                  d === rs.divisor
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                ].join(' ')}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Full mode ─────────────────────────────────────────────────────── */}
      {rs.mode === 'full' && (
        <div className="space-y-4">

          {/* Subdivisions */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-0.5">
              Allowed subdivisions
            </label>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">
              Which divisors are used when splitting a note. More divisors = more rhythmic variety.
            </p>
            <div className="flex gap-2">
              {FULL_DIVISORS.map(d => {
                const checked = rs.allowedDivisors.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleDivisor(d)}
                    aria-pressed={checked}
                    className={[
                      'px-3 py-1 text-sm font-semibold rounded-md border transition-colors',
                      checked
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
                    ].join(' ')}
                  >
                    ÷{d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Min note duration */}
          <Slider
            label="Min note duration"
            hint="Notes shorter than this won't be subdivided further. Lower = denser, more rapid notes."
            min={0.05} max={1.0} step={0.05}
            value={rs.minNoteSec}
            onChange={set('minNoteSec')}
            fmt={v => `${v.toFixed(2)} s`}
          />

          {/* Rest probability */}
          <Slider
            label="Rest probability"
            hint="Chance that a short note becomes silence. Higher = more space between notes."
            min={0} max={0.5} step={0.01}
            value={rs.restProb}
            onChange={set('restProb')}
            fmt={v => `${Math.round(v * 100)} %`}
          />

          {/* Join probability */}
          <Slider
            label="Join probability"
            hint="Chance adjacent subdivisions are merged into a longer note. Higher = more syncopation."
            min={0} max={0.8} step={0.01}
            value={rs.joinProb}
            onChange={set('joinProb')}
            fmt={v => `${Math.round(v * 100)} %`}
          />

          {/* Independent voice rhythms */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={rs.independentVoices}
              onChange={e => set('independentVoices')(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-violet-600 cursor-pointer"
            />
            <span className="space-y-0.5">
              <span className="text-sm text-slate-700 dark:text-slate-300 block">
                Independent voice rhythms
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 block">
                Each voice gets its own randomly generated rhythm. Off = all voices move together.
              </span>
            </span>
          </label>

        </div>
      )}
    </div>
  )
}
