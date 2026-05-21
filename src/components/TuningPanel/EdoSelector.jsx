const PRESETS = [
  { value: 12,  label: '12 — standard Western' },
  { value: 19,  label: '19 — meantone' },
  { value: 22,  label: '22' },
  { value: 34,  label: '34 — diaschisma' },
  { value: 53,  label: '53 — Pythagorean / Hanson' },
  { value: 65,  label: '65' },
  { value: 87,  label: '87' },
  { value: 99,  label: '99' },
  { value: 114, label: '114' },
  { value: 494, label: '494 — high precision' },
  { value: 612, label: '612 — extreme precision' },
]

const PRESET_VALUES = new Set(PRESETS.map(p => p.value))

const selectClass = [
  'rounded-lg border border-slate-300 dark:border-slate-700',
  'bg-white dark:bg-slate-900',
  'py-1.5 pl-3 pr-8 text-sm text-slate-900 dark:text-slate-100',
  'focus:outline-none focus:ring-2 focus:ring-violet-500',
].join(' ')

const inputClass = [
  'w-20 rounded-lg border border-slate-300 dark:border-slate-700',
  'bg-white dark:bg-slate-900',
  'py-1.5 px-2 text-sm font-semibold text-slate-900 dark:text-slate-100',
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
  'focus:outline-none focus:ring-2 focus:ring-violet-500',
].join(' ')

export default function EdoSelector({ edo, onChange }) {
  const set = (val) => {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 1 && n <= 9999) onChange(n)
  }

  const isPreset = PRESET_VALUES.has(edo)

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Equal Divisions of the Octave
      </label>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={isPreset ? edo : 'custom'}
          onChange={(e) => {
            if (e.target.value !== 'custom') set(e.target.value)
          }}
          className={selectClass}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>

        {/* Always-visible number input — shows current value, accepts typed custom EDO */}
        <input
          type="number"
          value={edo}
          onChange={(e) => set(e.target.value)}
          min={1}
          max={9999}
          className={inputClass}
          aria-label="EDO value"
        />
      </div>
    </div>
  )
}
