export default function PlaybackControls({ isPlaying, onPlay, onStop, tempoScale, onTempoChange }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <button
        onClick={isPlaying ? onStop : onPlay}
        className="px-4 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700
                   text-white transition-colors"
      >
        {isPlaying ? 'Stop' : 'Play'}
      </button>
      <label className="text-sm flex items-center gap-2">
        Tempo
        <input
          type="range"
          min="0.25"
          max="4"
          step="0.05"
          value={tempoScale}
          onChange={e => onTempoChange(Number(e.target.value))}
          className="w-28"
        />
        <span className="text-slate-500 tabular-nums w-12">{tempoScale.toFixed(2)}×</span>
      </label>
    </div>
  )
}
