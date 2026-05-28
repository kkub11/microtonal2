import { useState } from 'react'

function fmt(sec) {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

export default function PlaybackControls({
  isPlaying, onPlay, onStop,
  tempoScale, onTempoChange,
  masterGain, onMasterGainChange,
  playbackPos, totalDuration, onSeek,
  onTestTone,
}) {
  // localPos is non-null only while the user is dragging the scrubber
  const [localPos, setLocalPos] = useState(null)

  const displayPos = localPos ?? playbackPos
  const maxPos = Math.max(totalDuration, 1)

  return (
    <div className="space-y-3 w-full">

      {/* Scrubber row */}
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-slate-500 shrink-0 w-20">
          {fmt(displayPos)} / {fmt(totalDuration)}
        </span>
        <input
          type="range"
          min={0}
          max={maxPos}
          step={0.5}
          value={Math.min(localPos ?? playbackPos, maxPos)}
          onChange={e => setLocalPos(Number(e.target.value))}
          onPointerDown={() => setLocalPos(playbackPos)}
          onPointerUp={e => {
            const val = Number(e.currentTarget.value)
            setLocalPos(null)
            onSeek(val)
          }}
          className="flex-1 h-1.5 accent-blue-500"
          aria-label="Playback position"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={isPlaying ? onStop : onPlay}
          className="px-4 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700
                     text-white transition-colors"
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        {/* <button
          onClick={onTestTone}
          title="440 Hz at gain 1.0, bypassing all gain nodes. Loud = gain chain issue. Quiet = system/browser volume."
          className="px-3 py-2 rounded text-xs font-medium border border-slate-300
                     dark:border-slate-600 text-slate-500 dark:text-slate-400
                     hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Test Tone
        </button> */}
        <label className="text-sm flex items-center gap-2">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={masterGain}
            onChange={e => onMasterGainChange(Number(e.target.value))}
            className="w-28"
          />
          <span className="text-slate-500 tabular-nums w-10">{Math.round(masterGain * 100)}%</span>
        </label>
        <label className="text-sm flex items-center gap-2">
          Tempo
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={tempoScale}
            onChange={e => onTempoChange(Number(e.target.value))}
            className="w-28"
          />
          <span className="text-slate-500 tabular-nums w-12">{tempoScale.toFixed(2)}×</span>
        </label>
      </div>
    </div>
  )
}
