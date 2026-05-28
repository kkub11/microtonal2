const OPTIONS = [
  { value: 'sine',     label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'f1', label: 'F1 (pure sine)' },
  { value: 'f2', label: 'F2 (bright)' },
  { value: 'f3', label: 'F3' },
  { value: 'f4', label: 'F4' },
  { value: 'f5', label: 'F5' },
  { value: 'f6', label: 'F6' },
  { value: 'f7', label: 'F7 (rich)' },
]

export default function WaveformSelector({ value, onChange }) {
  return (
    <label className="text-sm flex items-center gap-2">
      Waveform
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1
                   bg-white dark:bg-slate-800 text-sm"
      >
        {OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
