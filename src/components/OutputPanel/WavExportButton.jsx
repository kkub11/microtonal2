import { useState } from 'react'
import { renderToWav, renderToWavFast, F_TABLES } from '../../utils/audioEngine'

export default function WavExportButton({ noteEvents, waveform, masterGain, snapshot }) {
  const [status, setStatus] = useState('idle')  // 'idle' | 'rendering' | 'error'
  const [method, setMethod] = useState('webaudio')  // 'webaudio' | 'fast'

  const canExport = noteEvents.length > 0

  async function handleExport() {
    if (!canExport || status === 'rendering') return
    setStatus('rendering')
    try {
      const isF     = waveform.startsWith('f')
      const render  = method === 'fast' ? renderToWavFast : renderToWav
      const blob    = await render(noteEvents, {
        waveform:  isF ? 'sine' : waveform,
        harmonics: isF ? F_TABLES[waveform] : null,
        masterGain,
      })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const temp = snapshot?.temperature != null ? `_T${snapshot.temperature.toFixed(1)}` : ''
      a.download = `score${temp}.wav`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('idle')
    } catch (err) {
      console.error('WAV export failed:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const label = status === 'rendering' ? 'Rendering…' : status === 'error' ? 'Error' : 'Export .wav'

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleExport}
        disabled={!canExport || status === 'rendering'}
        className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600
                   hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50
                   disabled:cursor-not-allowed transition-colors"
      >
        {label}
      </button>
      <select
        value={method}
        onChange={e => setMethod(e.target.value)}
        disabled={status === 'rendering'}
        title="Web Audio: exact match to playback, but slow on long pieces. Fast: sums samples directly, much faster on long pieces, but triangle/sawtooth/square will alias more."
        className="text-xs rounded border border-slate-300 dark:border-slate-600 bg-transparent
                   px-1 py-0.5 disabled:opacity-50"
      >
        <option value="webaudio">Web Audio (accurate)</option>
        <option value="fast">Fast render (long pieces)</option>
      </select>
    </div>
  )
}
