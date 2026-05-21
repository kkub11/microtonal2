import { useState } from 'react'
import { isPrime } from '../../utils/primeUtils'

const STANDARD_PRIMES = [3, 5, 7, 11, 13]
const MAX_COMMA_PRIME = 13

export default function PrimeSelector({ primes, onChange }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const nonTwoPrimes = primes.filter((p) => p !== 2)
  const customPrimes = nonTwoPrimes.filter((p) => !STANDARD_PRIMES.includes(p))
  const hasAbove13 = primes.some((p) => p > MAX_COMMA_PRIME)

  const toggleStandard = (p) => {
    if (primes.includes(p)) {
      if (nonTwoPrimes.length <= 1) return
      onChange(primes.filter((x) => x !== p))
    } else {
      onChange([...primes, p].sort((a, b) => a - b))
    }
  }

  const removeCustom = (p) => {
    if (nonTwoPrimes.length <= 1) return
    onChange(primes.filter((x) => x !== p))
  }

  const addPrime = () => {
    const n = parseInt(input, 10)
    if (isNaN(n) || n < 2) { setError('Enter a number ≥ 2'); return }
    if (!isPrime(n))        { setError(`${n} is not prime`); return }
    if (primes.includes(n)) { setError(`${n} is already selected`); return }
    setError('')
    setInput('')
    onChange([...primes, n].sort((a, b) => a - b))
  }

  const isLastPrime = (p) => primes.includes(p) && nonTwoPrimes.length === 1

  const toggleBtnClass = (selected, last) => [
    'px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors',
    selected
      ? 'bg-violet-600 text-white'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
    last ? 'opacity-60 cursor-not-allowed' : '',
  ].join(' ')

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Prime Limit
      </label>

      <div className="flex flex-wrap gap-2">
        {/* Prime 2 locked */}
        <span
          className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 select-none"
          title="Prime 2 (octave) is always included"
        >
          2
        </span>

        {/* Standard toggles */}
        {STANDARD_PRIMES.map((p) => (
          <button
            key={p}
            onClick={() => toggleStandard(p)}
            disabled={isLastPrime(p)}
            title={isLastPrime(p) ? 'At least one prime must be selected' : undefined}
            className={toggleBtnClass(primes.includes(p), isLastPrime(p))}
          >
            {p}
          </button>
        ))}

        {/* Custom primes with remove button */}
        {customPrimes.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white"
          >
            {p}
            <button
              onClick={() => removeCustom(p)}
              disabled={isLastPrime(p)}
              aria-label={`Remove prime ${p}`}
              className="w-4 h-4 rounded flex items-center justify-center text-violet-200 hover:text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Add custom prime */}
      <div className="flex items-center gap-2 mt-3">
        <input
          type="number"
          value={input}
          min={2}
          placeholder="Add prime…"
          onChange={(e) => { setInput(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && addPrime()}
          className="w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 px-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          onClick={addPrime}
          className="px-3 py-1 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Add
        </button>
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {hasAbove13 && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          ⚠ Primes above 13 are not in the comma file. Comma selection (step 3) will be unavailable.
        </p>
      )}
    </div>
  )
}
