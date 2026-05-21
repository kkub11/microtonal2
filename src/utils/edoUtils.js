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
