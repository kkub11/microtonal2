import { useMemo } from 'react'
import { useCommas } from '../../contexts/CommaContext'
import { filterCommas, monzoToCents, monzoToRatio, getCommaName } from '../../utils/commaUtils'

const MAX_DISPLAY = 200
const MAX_COMMA_PRIME = 13

function ratioString({ numerator, denominator }) {
  // Only show ratio if both sides fit in 9 decimal digits
  if (numerator <= 999_999_999n && denominator <= 999_999_999n) {
    return `${numerator}:${denominator}`
  }
  return null
}

function centsColor(absCents) {
  if (absCents < 5)  return 'text-emerald-600 dark:text-emerald-400'
  if (absCents < 20) return 'text-yellow-600 dark:text-yellow-400'
  if (absCents < 50) return 'text-orange-500 dark:text-orange-400'
  return 'text-red-500 dark:text-red-400'
}

function monzoLabel(monzo) {
  return '[' + monzo.join(' ') + ']'
}

export default function CommaList({ edo, primes, selectedComma, onSelect }) {
  const allCommas = useCommas()
  const hasAbove13 = primes.some(p => p > MAX_COMMA_PRIME)

  const enriched = useMemo(() => {
    if (!allCommas) return null
    const filtered = filterCommas(allCommas, primes, edo)
    return filtered
      .map(c => {
        const cents = monzoToCents(c.monzo)
        const ratio = monzoToRatio(c.monzo)
        const label = ratioString(ratio) ?? monzoLabel(c.monzo)
        const name = getCommaName(c.monzo)
        return { ...c, cents, label, name }
      })
      .sort((a, b) => Math.abs(a.cents) - Math.abs(b.cents))
      .slice(0, MAX_DISPLAY)
  }, [allCommas, primes, edo])

  if (hasAbove13) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Comma Selection
        </label>
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⚠ Primes above 13 are not in the comma file. Comma selection is unavailable.
        </p>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Comma Selection
      </label>

      {!allCommas && (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading commas…</p>
      )}

      {allCommas && enriched !== null && enriched.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          No commas found for {edo}-EDO with selected primes. Try a different EDO or prime set.
        </p>
      )}

      {allCommas && enriched !== null && enriched.length > 0 && (
        <>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
            {enriched.length} match{enriched.length !== 1 ? 'es' : ''} · sorted by size
            {enriched.length === MAX_DISPLAY ? ` (top ${MAX_DISPLAY} shown)` : ''}
          </p>

          <div className="overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700" style={{ maxHeight: 340 }}>
            {enriched.map((c, i) => {
              const isSelected =
                selectedComma &&
                selectedComma.monzo.join(',') === c.monzo.join(',')
              return (
                <button
                  key={i}
                  onClick={() => onSelect(c)}
                  className={[
                    'w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors',
                    'border-b border-slate-100 dark:border-slate-800 last:border-0',
                    isSelected
                      ? 'bg-violet-50 dark:bg-violet-950'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span className="min-w-0 truncate">
                    {c.name && (
                      <span className="block text-xs font-semibold text-violet-600 dark:text-violet-400 leading-none mb-0.5">
                        {c.name}
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                      {c.label}
                    </span>
                  </span>
                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${centsColor(Math.abs(c.cents))}`}>
                    {c.cents >= 0 ? '+' : ''}{c.cents.toFixed(2)}¢
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
