function gcd(a, b) {
  while (b) { [a, b] = [b, a % b] }
  return a
}

// Returns all just ratios p:q in (1:1, 2:1) where p and q are both
// prime-smooth (composed only of primes in the given set) and ≤ maxPQ.
function buildRatioList(primes, maxPQ) {
  function isSmooth(n) {
    let m = n
    for (const p of primes) { while (m % p === 0) m = Math.floor(m / p) }
    return m === 1
  }

  const smooth = []
  for (let n = 1; n <= maxPQ; n++) {
    if (isSmooth(n)) smooth.push(n)
  }

  const seen = new Set()
  const ratios = []
  for (const p of smooth) {
    for (const q of smooth) {
      if (p <= q || p >= 2 * q) continue           // keep strictly 1:1 < p:q < 2:1
      const g = gcd(p, q)
      const rp = p / g, rq = q / g
      const key = `${rp}:${rq}`
      if (seen.has(key)) continue
      seen.add(key)
      ratios.push({
        cents: 1200 * Math.log2(rp / rq),
        tenney: Math.log2(rp * rq),
      })
    }
  }
  return ratios
}

// Builds an N×N Float32Array of interval costs for all scale degree pairs.
// costTable[i*N + j] = cost of the interval from scale[i] to scale[j].
// Low cost = consonant; high cost = dissonant.
//
// Parameters:
//   power      (default 2.0)  — spreads the score range; increase for more primes
//   maxPQ      (default 20)   — upper bound on p and q in candidate ratios
//   proximityK (default 0.1)  — decay rate for cents deviation; higher = stricter
export function computeCostTable(scale, edo, primes, { power = 2.0, maxPQ = 20, proximityK = 0.1 } = {}) {
  const N = scale.length
  const table = new Float32Array(N * N)
  const ratios = buildRatioList(primes, maxPQ)
  const edoStepCents = 1200 / edo

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const intervalCents = ((scale[j] - scale[i] + edo) % edo) * edoStepCents
      if (intervalCents === 0) continue  // unison: cost stays 0.0
      let score = 0
      for (const { cents, tenney } of ratios) {
        const diff = Math.abs(cents - intervalCents)
        if (diff < 50) {
          score += Math.exp(-proximityK * diff) / Math.pow(tenney, power)
        }
      }
      table[i * N + j] = 1.0 / Math.max(score, 0.001)
    }
  }
  return table
}
