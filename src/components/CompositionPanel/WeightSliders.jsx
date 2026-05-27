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
        max={5}
        onChange={set('jumpWeight')}
      />
      <Slider
        label="Thematic weight"
        hint="phrase similarity"
        value={weights.thematicWeight}
        max={5}
        onChange={set('thematicWeight')}
      />
    </div>
  )
}
