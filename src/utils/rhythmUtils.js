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

/**
 * Longest a single note may last when the join cap is on (seconds).
 * Joins in slow measures can otherwise hold one pitch for most of a
 * measure (up to ~5 s with 4 s measures) — long enough to sound like a
 * drone rather than a note. 2 s is several times the usual minimum
 * note length but short enough that no pitch gets stuck.
 */
export const DEFAULT_MAX_NOTE_SEC = 2.0

function subdivide(startSec, durationSec, opts, depth) {
  const cap = opts.maxNoteSec
  const overCap = cap != null && durationSec > cap
  // Leaf: short enough, or deep enough — unless still over the cap, in
  // which case keep splitting (the +10 is an absolute safety valve so
  // a pathological config can never recurse forever).
  if ((durationSec <= opts.minNoteSec && !overCap) ||
      (depth >= opts.maxDepth && !overCap) ||
      depth >= opts.maxDepth + 10) {
    return [{ startSec, durationSec, isRest: Math.random() < opts.restProb }]
  }

  const n = opts.allowedDivisors[Math.floor(Math.random() * opts.allowedDivisors.length)]
  const part = durationSec / n
  const parts = Array.from({ length: n }, (_, i) => ({ s: startSec + i * part, d: part }))

  const slots = []
  let i = 0
  while (i < parts.length) {
    // A join must not create a note longer than the cap.
    const joinOk = i + 1 < parts.length &&
      (cap == null || parts[i].d + parts[i + 1].d <= cap)
    if (joinOk && Math.random() < opts.joinProb) {
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
 * @param {number[]} [options.allowedDivisors=[2,3,4,5]] - Which subdivisions to pick from
 * @param {number}   [options.minNoteSec=0.3]   - Minimum note duration before recursion stops
 * @param {number}   [options.restProb=0.08]    - Probability a leaf note becomes a rest
 * @param {number}   [options.joinProb=0.35]    - Probability of joining adjacent equal parts
 * @param {number}   [options.maxDepth=4]       - Maximum recursion depth
 * @param {number}   [options.maxNoteSec]       - Longest a single note may
 *   last (seconds). When set, joins never create a longer note and a slot
 *   over the cap keeps subdividing past maxDepth. Unset = no cap (the old
 *   behaviour: a note can last most of a measure). The UI exposes this as
 *   the "Cap long held notes" checkbox (DEFAULT_MAX_NOTE_SEC = 2.0 s).
 * @param {number}   [options.measureJitter=0]  - Per-measure tempo variation: each
 *   measure's length is scaled by 1 ± jitter (e.g. 0.15 = ±15%). 0 = every
 *   measure exactly measureSec long. Gives the piece breathing / rubato
 *   instead of a metronomic grid.
 * @returns {{ startSec: number, durationSec: number, isRest: boolean }[]}
 */
export function generateFullRhythm(numMeasures, measureSec, options = {}) {
  const opts = {
    allowedDivisors: options.allowedDivisors ?? [2, 3, 4, 5],
    minNoteSec:      options.minNoteSec      ?? 0.3,
    restProb:        options.restProb        ?? 0.08,
    joinProb:        options.joinProb        ?? 0.35,
    maxDepth:        options.maxDepth        ?? 4,
    maxNoteSec:      options.maxNoteSec,
  }
  const jitter = options.measureJitter ?? 0
  const events = []
  let offset = 0
  for (let m = 0; m < numMeasures; m++) {
    const dur = jitter === 0 ? measureSec : measureSec * (1 + (Math.random() * 2 - 1) * jitter)
    events.push(...subdivide(offset, dur, opts, 0))
    offset += dur
  }
  return events
}
