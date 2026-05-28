/**
 * Simple rhythm: one event per score-array slot, all equal duration.
 * @param {number} numMeasures - Number of rhythmic measures (= d1×d2×…×dn / divisor)
 * @param {number} measureSec - Duration of each rhythmic measure in seconds
 * @param {number} divisor - Notes per measure
 * @returns {{ startSec: number, durationSec: number, isRest: boolean }[]}
 *   Returns numMeasures * divisor events.
 */
export function generateSimpleRhythm(numMeasures, measureSec, divisor) {
  const noteDuration = measureSec / divisor
  const events = []
  for (let m = 0; m < numMeasures; m++) {
    const offset = m * measureSec
    for (let d = 0; d < divisor; d++) {
      events.push({ startSec: offset + d * noteDuration, durationSec: noteDuration, isRest: false })
    }
  }
  return events
}

function subdivide(startSec, durationSec, opts, depth) {
  if (durationSec <= opts.minNoteSec || depth >= opts.maxDepth) {
    return [{ startSec, durationSec, isRest: Math.random() < opts.restProb }]
  }

  const n = [2, 3, 4, 5][Math.floor(Math.random() * 4)]
  const part = durationSec / n
  const parts = Array.from({ length: n }, (_, i) => ({ s: startSec + i * part, d: part }))

  const slots = []
  let i = 0
  while (i < parts.length) {
    if (i + 1 < parts.length && Math.random() < opts.joinProb) {
      slots.push({ s: parts[i].s, d: parts[i].d + parts[i + 1].d })
      i += 2
    } else {
      slots.push(parts[i])
      i++
    }
  }

  return slots.flatMap(sl => subdivide(sl.s, sl.d, opts, depth + 1))
}

/**
 * Full rhythm: recursive subdivision with joining and rests.
 * @param {number} numMeasures - Number of rhythmic measures
 * @param {number} measureSec - Duration of each measure in seconds
 * @param {object} [options]
 * @param {number} [options.minNoteSec=0.3] - Minimum note duration before recursion stops
 * @param {number} [options.restProb=0.08] - Probability a leaf note becomes a rest
 * @param {number} [options.joinProb=0.35] - Probability of joining adjacent equal parts
 * @param {number} [options.maxDepth=4] - Maximum recursion depth
 * @returns {{ startSec: number, durationSec: number, isRest: boolean }[]}
 */
export function generateFullRhythm(numMeasures, measureSec, options = {}) {
  const opts = {
    minNoteSec: options.minNoteSec ?? 0.3,
    restProb:   options.restProb   ?? 0.08,
    joinProb:   options.joinProb   ?? 0.35,
    maxDepth:   options.maxDepth   ?? 4,
  }
  const events = []
  for (let m = 0; m < numMeasures; m++) {
    events.push(...subdivide(m * measureSec, measureSec, opts, 0))
  }
  return events
}
