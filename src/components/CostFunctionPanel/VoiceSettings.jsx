// Log-scale Hz slider: 50–2000 Hz
const HZ_MIN = 50, HZ_MAX = 2000

function hzToSlider(hz) {
  return (Math.log(hz) - Math.log(HZ_MIN)) / (Math.log(HZ_MAX) - Math.log(HZ_MIN)) * 100
}
function sliderToHz(v) {
  return Math.round(HZ_MIN * Math.pow(HZ_MAX / HZ_MIN, v / 100))
}

function hzToNoteName(hz) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  const midi = 69 + 12 * Math.log2(hz / 440)
  const rounded = Math.round(midi)
  const name = names[((rounded % 12) + 12) % 12]
  const octave = Math.floor(rounded / 12) - 1
  return `${name}${octave}`
}

// Default centers: ascending fifths from C3
const DEFAULT_HZ = [131, 196, 294, 441, 661]
function defaultCenterHz(v) {
  return DEFAULT_HZ[v] ?? Math.round(131 * Math.pow(1.5, v))
}

export { defaultCenterHz }

export default function VoiceSettings({ voiceCount, voiceSettings, onChange }) {
  function update(v, centerHz) {
    const next = Array.from({ length: voiceCount }, (_, i) =>
      voiceSettings[i] ?? { centerHz: defaultCenterHz(i) }
    )
    next[v] = { centerHz }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: voiceCount }, (_, v) => {
        const vs = voiceSettings[v] ?? { centerHz: defaultCenterHz(v) }
        const hz = vs.centerHz ?? defaultCenterHz(v)
        return (
          <div key={v} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Voice {v + 1}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {hzToNoteName(hz)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0} max={100} step={0.5}
                value={hzToSlider(hz)}
                onChange={e => update(v, sliderToHz(Number(e.target.value)))}
                className="flex-1 accent-violet-600"
              />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min={HZ_MIN} max={HZ_MAX} step={1}
                  value={hz}
                  onChange={e => {
                    const v2 = Math.max(HZ_MIN, Math.min(HZ_MAX, Number(e.target.value)))
                    if (!isNaN(v2)) update(v, v2)
                  }}
                  className="w-16 text-right px-1 py-0.5 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">Hz</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
