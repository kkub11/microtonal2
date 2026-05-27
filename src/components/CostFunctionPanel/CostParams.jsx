function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-violet-600"
      />
    </div>
  )
}

export default function CostParams({ params, onChange }) {
  const set = key => val => onChange({ ...params, [key]: val })

  return (
    <div className="space-y-4">
      <Slider
        label="Power — spreads score range (larger = greater contrast)"
        value={params.power} min={0.5} max={4} step={0.1}
        onChange={set('power')} format={v => v.toFixed(1)}
      />
      <Slider
        label="Proximity K — strictness of just-ratio matching"
        value={params.proximityK} min={0.01} max={1} step={0.01}
        onChange={set('proximityK')} format={v => v.toFixed(2)}
      />
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500 dark:text-slate-400">
            Max P/Q — largest numerator/denominator in candidate ratios
          </span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
            {params.maxPQ}
          </span>
        </div>
        <input
          type="number" min={4} max={500} value={params.maxPQ}
          onChange={e => {
            const v = Math.max(4, Math.min(500, Number(e.target.value)))
            if (Number.isFinite(v)) set('maxPQ')(v)
          }}
          className="w-24 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
        />
      </div>
    </div>
  )
}
