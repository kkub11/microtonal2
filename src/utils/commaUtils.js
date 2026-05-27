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

// A comma is tempered out by an EDO if and only if it maps to exactly 0 steps.
export function isTempered(monzo, edo) {
  let steps = 0
  for (let i = 0; i < monzo.length; i++) {
    if (monzo[i] !== 0) {
      steps += monzo[i] * Math.round(edo * Math.log2(PRIMES[i]))
    }
  }
  return steps === 0
}

// Both canonical and inverse forms are recognised.
const NAMED_COMMAS = {
  '-15,8,1,0,0,0':  'Schisma',
  '15,-8,-1,0,0,0': 'Schisma',
  '-6,-5,6,0,0,0':  'Kleisma',
  '6,5,-6,0,0,0':   'Kleisma',
  '-4,4,-1,0,0,0':  'Syntonic comma',
  '4,-4,1,0,0,0':   'Syntonic comma',
  '-5,2,2,-1,0,0':  'Marvel comma',
  '5,-2,-2,1,0,0':  'Marvel comma',
  '-19,12,0,0,0,0': 'Pythagorean comma',
  '19,-12,0,0,0,0': 'Pythagorean comma',
}

export function getCommaName(monzo) {
  return NAMED_COMMAS[monzo.join(',')] ?? null
}

export function filterCommas(commas, primes, edo) {
  const allowedIndices = new Set(
    primes.map(p => PRIMES.indexOf(p)).filter(i => i !== -1)
  )
  return commas.filter(({ monzo }) => {
    for (let i = 0; i < monzo.length; i++) {
      if (monzo[i] !== 0 && !allowedIndices.has(i)) return false
    }
    return isTempered(monzo, edo)
  })
}

// Returns projection info for the comma onto the two Tonnetz axes.
// - isProjected: true if any comma prime is outside the axis span
// - extraPrimes: primes in the comma not covered by either axis (the hop primes)
// - axisPrimes: non-2 primes covered by the axes (defines the "view plane")
// - commaPrimes: all non-2 primes present in the comma
export function getCommaProjectionInfo(monzo, xInterval, yInterval) {
  const xMonzo = ratioToMonzo(xInterval.ratio[0], xInterval.ratio[1])
  const yMonzo = ratioToMonzo(yInterval.ratio[0], yInterval.ratio[1])

  const axisSpan = new Set()
  for (let i = 1; i < xMonzo.length; i++) {
    if (xMonzo[i] !== 0) axisSpan.add(i)
    if (yMonzo[i] !== 0) axisSpan.add(i)
  }

  const extraPrimes = []
  const commaPrimes = []
  for (let i = 1; i < monzo.length; i++) {
    if (monzo[i] !== 0) commaPrimes.push(PRIMES[i])
    if (monzo[i] !== 0 && !axisSpan.has(i)) extraPrimes.push(PRIMES[i])
  }
  const axisPrimes = [...axisSpan].map(i => PRIMES[i]).sort((a, b) => a - b)

  return { isProjected: extraPrimes.length > 0, extraPrimes, axisPrimes, commaPrimes }
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

// Finds the nearest Tonnetz cell (lx, ly) to (fromLx, fromLy) that has targetPC.
// Used to resolve hop destinations to a specific grid position.
function findNearestGridCell(targetPC, fromLx, fromLy, xSteps, ySteps, edo) {
  const MAX = 40
  let best = null, bestDist = Infinity
  for (let dlx = -MAX; dlx <= MAX; dlx++) {
    for (let dly = -MAX; dly <= MAX; dly++) {
      if (dlx === 0 && dly === 0) continue
      const lx = fromLx + dlx, ly = fromLy + dly
      const pc = ((lx * xSteps + ly * ySteps) % edo + edo) % edo
      if (pc === targetPC) {
        const dist = dlx * dlx + dly * dly
        if (dist < bestDist) { bestDist = dist; best = [lx, ly] }
      }
    }
  }
  return best ?? [fromLx, fromLy]
}

// Converts a rich path (from commaToTonnetzPath) into grid positions.
// Each position: { lx, ly, moveType: 'origin'|'step'|'hop', ...hopInfo }
// Hop positions also carry: fromLx, fromLy, fromPC, toPC, prime
export function commaPathPositions(moves, xSteps, ySteps, edo) {
  const positions = [{ lx: 0, ly: 0, moveType: 'origin' }]
  let lx = 0, ly = 0
  for (const move of moves) {
    if (move.type === 'step') {
      lx += move.dx; ly += move.dy
      positions.push({ lx, ly, moveType: 'step' })
    } else {
      const hopDelta = move.exponent * Math.round(edo * Math.log2(PRIMES[move.primeIndex]))
      const currentPC = ((lx * xSteps + ly * ySteps) % edo + edo) % edo
      const targetPC = ((currentPC + hopDelta) % edo + edo) % edo
      const fromLx = lx, fromLy = ly
      const dest = findNearestGridCell(targetPC, fromLx, fromLy, xSteps, ySteps, edo)
      lx = dest[0]; ly = dest[1]
      positions.push({
        lx, ly, moveType: 'hop',
        fromLx, fromLy, fromPC: currentPC, toPC: targetPC,
        prime: PRIMES[move.primeIndex],
      })
    }
  }
  return positions
}

// Returns a sequence of move objects tracing the comma through the Tonnetz.
// Each element is either { type: 'step', dx, dy } (one axis step) or
// { type: 'hop', primeIndex, exponent } (jump along a non-axis prime).
// xInterval and yInterval are { ratio: [numerator, denominator] }.
export function commaToTonnetzPath(monzo, xInterval, yInterval) {
  const xMonzo = ratioToMonzo(xInterval.ratio[0], xInterval.ratio[1])
  const yMonzo = ratioToMonzo(yInterval.ratio[0], yInterval.ratio[1])

  // Prime indices (non-octave) covered by at least one axis
  const axisSet = new Set()
  for (let i = 1; i < xMonzo.length; i++) {
    if (xMonzo[i] !== 0) axisSet.add(i)
    if (yMonzo[i] !== 0) axisSet.add(i)
  }

  // Separate hop primes (not spanned by axes) from axis-covered primes
  const hops = []
  const axisMonzo = monzo.slice()
  for (let i = 1; i < monzo.length; i++) {
    if (monzo[i] !== 0 && !axisSet.has(i)) {
      hops.push({ type: 'hop', primeIndex: i, exponent: monzo[i] })
      axisMonzo[i] = 0
    }
  }

  // Solve for axis steps using only the axis-covered components
  const xVec = xMonzo.slice(1)
  const yVec = yMonzo.slice(1)
  const cVec = axisMonzo.slice(1)

  let i0 = xVec.findIndex((v, i) => v !== 0 && yVec[i] === 0)
  let i1 = yVec.findIndex((v, i) => v !== 0 && xVec[i] === 0)

  if (i0 < 0 || i1 < 0) {
    const candidates = xVec.map((_, i) => i).filter(i => xVec[i] !== 0 || yVec[i] !== 0)
    i0 = candidates[0] ?? 0
    i1 = candidates[1] ?? 1
  }

  const sol = solve2x2(xVec[i0], yVec[i0], xVec[i1], yVec[i1], cVec[i0], cVec[i1])
  if (!sol) return hops  // no axis solution — return just the hops (or [] if no hops)

  const [a, b] = sol.map(Math.round)
  const sx = Math.sign(a), sy = Math.sign(b)
  const na = Math.abs(a), nb = Math.abs(b)
  const total = na + nb

  // Generate zigzag axis steps (Bresenham-style)
  const axisSteps = []
  let xDone = 0
  for (let i = 0; i < total; i++) {
    const xTarget = Math.round((i + 1) * na / total)
    if (xTarget > xDone) { axisSteps.push({ type: 'step', dx: sx, dy: 0 }); xDone++ }
    else axisSteps.push({ type: 'step', dx: 0, dy: sy })
  }

  if (hops.length === 0) return axisSteps

  // Interleave hops at the midpoint of the axis step sequence
  const half = Math.floor(axisSteps.length / 2)
  return [...axisSteps.slice(0, half), ...hops, ...axisSteps.slice(half)]
}
