export default function StartStopButton({ status, disabled, onStart, onPauseResume, onReset }) {
  return (
    <div className="flex gap-2">
      {status === 'idle' ? (
        <button
          onClick={onStart}
          disabled={disabled}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
        >
          Start
        </button>
      ) : (
        <>
          <button
            onClick={onPauseResume}
            className={[
              'px-5 py-2 text-sm font-bold rounded-lg transition-colors text-white',
              status === 'running'
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-emerald-600 hover:bg-emerald-700',
            ].join(' ')}
          >
            {status === 'running' ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Reset
          </button>
        </>
      )}
    </div>
  )
}
