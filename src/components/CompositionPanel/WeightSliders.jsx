function Slider({ label, hint, value, max, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 dark:text-slate-400">
          {label}
          {hint && <span className="ml-1 text-slate-400 dark:text-slate-500">({hint})</span>}
        </span>
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
          {value.toFixed(2)}
        </span>
      </div>
      <input type="range" min={0} max={max} step={0.05} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-violet-600"
      />
    </div>
  )
}

export default function WeightSliders({ weights, onChange }) {
  const set = key => val => onChange({ ...weights, [key]: val })
  return (
    <div className="space-y-3">
      <Slider
        label="Range weight"
        hint="voice center penalty"
        value={weights.rangeWeight}
        max={5}
        onChange={set('rangeWeight')}
      />
      <Slider
        label="Jump weight"
        hint="melodic leap penalty"
        value={weights.jumpWeight}
        max={10}
        onChange={set('jumpWeight')}
      />
      <Slider
        label="Thematic weight"
        hint="long-range phrase match"
        value={weights.thematicWeight}
        max={5}
        onChange={set('thematicWeight')}
      />
      <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
        <input
          type="checkbox"
          checked={weights.thematicTransposed ?? false}
          onChange={e => set('thematicTransposed')(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-violet-600 cursor-pointer"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Transposed phrase matching (Jim&apos;s full Term 4): a phrase may come back
          shifted, not just repeated. Subtle at the default weight — raise the
          Thematic slider for a stronger effect. Works best with a motif seeded.
        </span>
      </label>
    </div>
  )
}
