const PRIMES = [2, 3, 5, 7, 11, 13]

function parseCommaLine(line) {
  const match = line.match(/\[\s*([-\d\s]+)\s*>\s*(\d+)/)
  if (!match) return null
  const monzo = match[1].trim().split(/\s+/).map(Number)
  const bestEdo = parseInt(match[2], 10)
  return { monzo, bestEdo }
}

export function parseCommasText(text) {
  return text.trim().split('\n').map(parseCommaLine).filter(Boolean)
}

export async function loadCommas(url = '/commas_best.txt') {
  const text = await fetch(url).then(r => r.text())
  return parseCommasText(text)
}

export function monzoToRatio(monzo) {
  let numerator = 1n
  let denominator = 1n
  for (let i = 0; i < monzo.length; i++) {
    const p = BigInt(PRIMES[i])
    const e = monzo[i]
    if (e > 0) numerator *= p ** BigInt(e)
    else if (e < 0) denominator *= p ** BigInt(-e)
  }
  return { numerator, denominator }
}

export function monzoToCents(monzo) {
  let cents = 0
  for (let i = 0; i < monzo.length; i++) {
    cents += monzo[i] * Math.log2(PRIMES[i]) * 1200
  }
  return cents
}

// edoTolerance: fraction of edo (e.g. 0.15 = ±15%)
export function filterCommas(commas, primes, edo, edoTolerance = 0.15) {
  const allowedIndices = new Set(
    primes.map(p => PRIMES.indexOf(p)).filter(i => i !== -1)
  )
  return commas.filter(({ monzo, bestEdo }) => {
    for (let i = 0; i < monzo.length; i++) {
      if (monzo[i] !== 0 && !allowedIndices.has(i)) return false
    }
    return Math.abs(bestEdo - edo) / edo <= edoTolerance
  })
}

function ratioToMonzo(num, den) {
  const monzo = new Array(PRIMES.length).fill(0)
  let n = num, d = den
  for (let i = 0; i < PRIMES.length; i++) {
    while (n % PRIMES[i] === 0) { n /= PRIMES[i]; monzo[i]++ }
    while (d % PRIMES[i] === 0) { d /= PRIMES[i]; monzo[i]-- }
  }
  return monzo
}

function solve2x2(m00, m01, m10, m11, r0, r1) {
  const det = m00 * m11 - m01 * m10
  if (det === 0) return null
  return [(m11 * r0 - m01 * r1) / det, (m00 * r1 - m10 * r0) / det]
}

// Returns a sequence of [dx, dy] unit moves through the Tonnetz that traces the comma.
// xInterval and yInterval are { ratio: [numerator, denominator] }.
export function commaToTonnetzPath(monzo, xInterval, yInterval) {
  const xMonzo = ratioToMonzo(xInterval.ratio[0], xInterval.ratio[1])
  const yMonzo = ratioToMonzo(yInterval.ratio[0], yInterval.ratio[1])

  // Skip prime 2 (index 0) — octave adjustments are free
  const xVec = xMonzo.slice(1)
  const yVec = yMonzo.slice(1)
  const cVec = monzo.slice(1)

  // Find two row indices for the 2×2 system. Prefer rows where one vector
  // is zero so the system decouples cleanly (common for standard Tonnetz axes).
  let i0 = xVec.findIndex((v, i) => v !== 0 && yVec[i] === 0)
  let i1 = yVec.findIndex((v, i) => v !== 0 && xVec[i] === 0)

  if (i0 < 0 || i1 < 0) {
    // Fallback: pick the first two dimensions where either vec is non-zero
    const candidates = xVec.map((_, i) => i).filter(i => xVec[i] !== 0 || yVec[i] !== 0)
    i0 = candidates[0] ?? 0
    i1 = candidates[1] ?? 1
  }

  const sol = solve2x2(xVec[i0], yVec[i0], xVec[i1], yVec[i1], cVec[i0], cVec[i1])
  if (!sol) return []

  const [a, b] = sol.map(Math.round)
  const path = []
  const sx = Math.sign(a), sy = Math.sign(b)
  for (let i = 0; i < Math.abs(a); i++) path.push([sx, 0])
  for (let i = 0; i < Math.abs(b); i++) path.push([0, sy])
  return path
}
