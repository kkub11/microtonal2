export default function VoiceCountSelector({ voiceCount, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
        Voices
      </label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map(n => (
          <button key={n}
            onClick={() => onChange(n)}
            className={[
              'w-9 h-9 text-sm font-bold rounded-lg transition-colors',
              n === voiceCount
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
