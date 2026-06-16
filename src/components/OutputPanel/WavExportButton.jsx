import { useState } from 'react'
import { renderToWav, F_TABLES } from '../../utils/audioEngine'

export default function WavExportButton({ noteEvents, waveform, masterGain, snapshot }) {
  const [status, setStatus] = useState('idle')  // 'idle' | 'rendering' | 'error'

  const canExport = noteEvents.length > 0

  async function handleExport() {
    if (!canExport || status === 'rendering') return
    setStatus('rendering')
    try {
      const isF      = waveform.startsWith('f')
      const blob     = await renderToWav(noteEvents, {
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
    <button
      onClick={handleExport}
      disabled={!canExport || status === 'rendering'}
      className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600
                 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50
                 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}
