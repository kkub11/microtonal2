export default function VoiceSettings({ voiceCount, voiceSettings, scale, edo, onChange }) {
  if (!scale || scale.length === 0) return null

  const N = scale.length
  const edoStepCents = 1200 / edo

  function update(v, patch) {
    const next = Array.from({ length: voiceCount }, (_, i) =>
      voiceSettings[i] ?? { center: Math.floor(N / 2), range: N }
    )
    next[v] = { ...next[v], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: voiceCount }, (_, v) => {
        const s = voiceSettings[v] ?? { center: Math.floor(N / 2), range: N }
        return (
          <div key={v} className="grid grid-cols-[4rem_1fr_1fr] gap-3 items-center">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Voice {v + 1}
            </span>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Center pitch</div>
              <select
                value={s.center}
                onChange={e => update(v, { center: Number(e.target.value) })}
                className="w-full px-2 py-1 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                {scale.map((step, i) => (
                  <option key={i} value={i}>
                    {Math.round(step * edoStepCents)}¢ (degree {i})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-slate-500 dark:text-slate-400">Range (degrees)</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  ±{s.range}
                </span>
              </div>
              <input
                type="range" min={1} max={N} step={1} value={s.range}
                onChange={e => update(v, { range: Number(e.target.value) })}
                className="w-full accent-violet-600"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
