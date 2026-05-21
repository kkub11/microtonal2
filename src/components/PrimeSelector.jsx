const OPTIONAL_PRIMES = [3, 5, 7, 11, 13]

export default function PrimeSelector({ primes, onChange }) {
  const toggle = (p) => {
    if (primes.includes(p)) {
      // Keep at least one optional prime selected
      const remaining = primes.filter((x) => x !== 2 && x !== p)
      if (remaining.length === 0) return
      onChange(primes.filter((x) => x !== p))
    } else {
      onChange([...primes, p].sort((a, b) => a - b))
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Prime Limit
      </label>

      <div className="flex flex-wrap gap-2">
        {/* 2 is always included */}
        <span
          className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 select-none"
          title="Prime 2 (octave) is always included"
        >
          2
        </span>

        {OPTIONAL_PRIMES.map((p) => {
          const selected = primes.includes(p)
          const isLast = selected && primes.filter((x) => x !== 2).length === 1
          return (
            <button
              key={p}
              onClick={() => toggle(p)}
              disabled={isLast}
              title={isLast ? 'At least one prime must be selected' : undefined}
              className={[
                'px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors',
                selected
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                isLast ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {p}
            </button>
          )
        })}
      </div>
    </div>
  )
}
