export function getStepFreq(edo, step, baseHz) {
  return baseHz * Math.pow(2, step / edo)
}

export function getBestApprox(edo, numerator, denominator) {
  const justCents = 1200 * Math.log2(numerator / denominator)
  const stepCents = 1200 / edo
  return Math.round(justCents / stepCents)
}

export function computeTuningError(edo, primes) {
  const errors = {}
  for (let i = 0; i < primes.length; i++) {
    for (let j = i + 1; j < primes.length; j++) {
      const p = primes[i]
      const q = primes[j]
      const justCents = 1200 * Math.log2(p / q)
      const stepCents = 1200 / edo
      const bestStep = Math.round(justCents / stepCents)
      const approxCents = bestStep * stepCents
      // error as fraction of one step: positive = sharp, negative = flat
      const errorFrac = (approxCents - justCents) / stepCents
      errors[`${p}:${q}`] = { bestStep, errorFrac }
    }
  }
  return errors
}
