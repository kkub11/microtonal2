function gcd(a, b) {
  while (b) { [a, b] = [b, a % b] }
  return a
}

export const INTERVAL_NAMES = {
  '3:2': 'perfect fifth',    '4:3': 'perfect fourth',
  '5:4': 'major third',      '6:5': 'minor third',
  '5:3': 'major sixth',      '8:5': 'minor sixth',
  '7:4': 'harmonic seventh', '7:6': 'septimal minor third',
  '8:7': 'septimal major second', '7:5': 'septimal tritone',
  '9:7': 'subminor third',   '9:8': 'whole tone',
  '9:5': 'major seventh (9:5)', '10:9': 'small whole tone',
  '11:8': 'undecimal tritone', '13:8': 'tridecimal major sixth',
  '11:6': 'undecimal major seventh', '12:11': 'undecimal minor second',
  '13:12': 'tridecimal minor second', '15:8': 'major seventh',
  '16:9': 'minor seventh',   '16:15': 'diatonic semitone',
}

// Returns just intervals whose numerator and denominator are both composed
// of primes from the given set, with Tenney complexity ≤ maxTenney, sorted
// by ascending Tenney. Covers ratios strictly between 1:1 and 2:1.
export function enumerateJustIntervals(primes, maxTenney = 7) {
  const maxN = Math.round(Math.pow(2, maxTenney))

  function isSmooth(n) {
    let m = n
    for (const p of primes) {
      while (m % p === 0) m = Math.floor(m / p)
    }
    return m === 1
  }

  const smooth = []
  for (let n = 2; n <= maxN; n++) {
    if (isSmooth(n)) smooth.push(n)
  }

  const seen = new Set()
  const intervals = []
  for (const a of smooth) {
    for (const b of smooth) {
      if (a <= b || a >= 2 * b) continue
      const g = gcd(a, b)
      const p = a / g, q = b / g
      const tenney = Math.log2(p * q)
      if (tenney > maxTenney) continue
      const key = `${p}:${q}`
      if (seen.has(key)) continue
      seen.add(key)
      intervals.push({
        ratio: [p, q],
        cents: 1200 * Math.log2(p / q),
        tenney,
        name: INTERVAL_NAMES[key] || `${p}:${q}`,
      })
    }
  }

  return intervals.sort((a, b) => a.tenney - b.tenney)
}

export function getStepFreq(edo, step, baseHz) {
  return baseHz * Math.pow(2, step / edo)
}

export function getBestApprox(edo, numerator, denominator) {
  const justCents = 1200 * Math.log2(numerator / denominator)
  const stepCents = 1200 / edo
  return Math.round(justCents / stepCents)
}

// Returns errors[hi][lo] = unsigned error in fractions of one EDO step,
// where hi:lo is the ascending interval (hi > lo). 0 = perfect, 0.5 = worst.
export function computeTuningError(edo, primes) {
  const errors = {}
  for (let i = 0; i < primes.length; i++) {
    for (let j = i + 1; j < primes.length; j++) {
      const lo = primes[i]
      const hi = primes[j]
      const justSteps = edo * Math.log2(hi / lo)
      const bestStep = Math.round(justSteps)
      if (!errors[hi]) errors[hi] = {}
      errors[hi][lo] = Math.abs(justSteps - bestStep)
    }
  }
  return errors
}
