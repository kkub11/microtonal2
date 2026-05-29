// Log-scale mapping: slider 0–100 ↔ T 0.1–100000
const T_MIN = 0.1, T_MAX = 100000
const LOG_MIN = Math.log(T_MIN)
const LOG_MAX = Math.log(T_MAX)

export function sliderToTemp(v) {
  return Math.exp(LOG_MIN + (v / 100) * (LOG_MAX - LOG_MIN))
}
export function tempToSlider(T) {
  return (Math.log(Math.max(T_MIN, Math.min(T_MAX, T))) - LOG_MIN) / (LOG_MAX - LOG_MIN) * 100
}

export default function TemperatureSlider({
  temperature, onChange,
  autoCool, onAutoCoolChange,
  coolRate, onCoolRateChange,
  disabled,
}) {
  return (
    <div className="space-y-3">
      {/* Primary T display */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-mono font-bold text-violet-600 dark:text-violet-400 tabular-nums">
          {temperature < 10 ? temperature.toFixed(2)
            : temperature < 100 ? temperature.toFixed(1)
            : temperature.toFixed(0)}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">temperature T</span>
      </div>

      {/* Large slider */}
      <input
        type="range" min={0} max={100} step={0.5}
        value={tempToSlider(temperature)}
        onChange={e => onChange(sliderToTemp(Number(e.target.value)))}
        disabled={disabled}
        className="w-full h-3 accent-violet-600 cursor-pointer disabled:opacity-40 disabled:cursor-default"
        style={{ appearance: 'auto' }}
      />
      <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 font-mono select-none">
        <span>0.1</span><span>1</span><span>100</span><span>10k</span><span>100k</span>
      </div>

      {/* Auto-cool controls */}
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoCool}
            onChange={e => onAutoCoolChange(e.target.checked)}
            className="accent-violet-600 w-4 h-4"
          />
          <span className="text-slate-700 dark:text-slate-300">Auto-cool</span>
        </label>

        {autoCool && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Rate</span>
            <input
              type="range" min={0.990} max={0.9999} step={0.0001}
              value={coolRate}
              onChange={e => onCoolRateChange(Number(e.target.value))}
              className="w-24 accent-violet-600"
            />
            <span className="font-mono text-slate-600 dark:text-slate-400">
              ×{coolRate.toFixed(4)}/tick
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
