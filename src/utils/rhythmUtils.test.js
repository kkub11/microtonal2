import { describe, test, expect } from 'vitest'
import { generateSimpleRhythm, generateFullRhythm } from './rhythmUtils.js'

describe('generateSimpleRhythm', () => {
  test('returns numMeasures * divisor events', () => {
    expect(generateSimpleRhythm(6, 5.0, 4)).toHaveLength(24)
    expect(generateSimpleRhythm(10, 2.0, 3)).toHaveLength(30)
    expect(generateSimpleRhythm(54, 5.0, 4)).toHaveLength(216)
  })

  test('no rests', () => {
    expect(generateSimpleRhythm(8, 5.0, 4).every(e => e.isRest === false)).toBe(true)
  })

  test('all notes have duration measureSec / divisor', () => {
    const expected = 5.0 / 4
    generateSimpleRhythm(8, 5.0, 4).forEach(e => expect(e.durationSec).toBeCloseTo(expected))
  })

  test('events are contiguous with no gaps', () => {
    const events = generateSimpleRhythm(6, 5.0, 4)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].startSec).toBeCloseTo(events[i - 1].startSec + events[i - 1].durationSec)
    }
  })

  test('first event starts at 0', () => {
    expect(generateSimpleRhythm(4, 5.0, 2)[0].startSec).toBe(0)
  })

  test('total duration equals numMeasures * measureSec', () => {
    const events = generateSimpleRhythm(7, 5.0, 4)
    const last = events[events.length - 1]
    expect(last.startSec + last.durationSec).toBeCloseTo(7 * 5.0)
  })

  test('divisor=1 gives one note per measure of full measureSec duration', () => {
    const events = generateSimpleRhythm(5, 5.34, 1)
    expect(events).toHaveLength(5)
    events.forEach(e => expect(e.durationSec).toBeCloseTo(5.34))
  })
})

describe('generateFullRhythm', () => {
  test('returns more events than numMeasures (subdivision occurred)', () => {
    const events = generateFullRhythm(10, 5.0, { minNoteSec: 0.1, maxDepth: 3, restProb: 0 })
    expect(events.length).toBeGreaterThan(10)
  })

  test('all durations are positive', () => {
    generateFullRhythm(8, 5.0).forEach(e => expect(e.durationSec).toBeGreaterThan(0))
  })

  test('total duration equals numMeasures * measureSec', () => {
    const events = generateFullRhythm(8, 5.0, { minNoteSec: 0.1, maxDepth: 3 })
    const total = events.reduce((sum, e) => sum + e.durationSec, 0)
    expect(total).toBeCloseTo(8 * 5.0, 6)
  })

  test('events are contiguous with no gaps', () => {
    const events = generateFullRhythm(4, 5.0, { minNoteSec: 0.1 })
    for (let i = 1; i < events.length; i++) {
      expect(events[i].startSec).toBeCloseTo(events[i - 1].startSec + events[i - 1].durationSec, 8)
    }
  })

  test('first event starts at 0', () => {
    expect(generateFullRhythm(4, 5.0)[0].startSec).toBeCloseTo(0)
  })

  test('isRest is boolean', () => {
    generateFullRhythm(4, 5.0).forEach(e => expect(typeof e.isRest).toBe('boolean'))
  })

  test('restProb=0 produces no rests', () => {
    const events = generateFullRhythm(20, 5.0, { restProb: 0 })
    expect(events.every(e => !e.isRest)).toBe(true)
  })

  test('restProb=1 produces all rests', () => {
    const events = generateFullRhythm(20, 5.0, { restProb: 1 })
    expect(events.every(e => e.isRest)).toBe(true)
  })

  test('no subdivision when measureSec <= minNoteSec', () => {
    const events = generateFullRhythm(6, 0.25, { minNoteSec: 0.3, maxDepth: 10, restProb: 0 })
    expect(events).toHaveLength(6)
    events.forEach(e => expect(e.durationSec).toBeCloseTo(0.25))
  })

  test('allowedDivisors=[2] produces only power-of-2 fractions of measureSec (joinProb=0)', () => {
    const measureSec = 8
    const events = generateFullRhythm(4, measureSec, {
      allowedDivisors: [2],
      joinProb: 0,
      restProb: 0,
      minNoteSec: 0.5,
      maxDepth: 10,
    })
    // With ÷2 only and no joining, all leaf durations are measureSec / 2^k
    const allowed = new Set([8, 4, 2, 1, 0.5])
    events.forEach(e => {
      expect(allowed.has(Math.round(e.durationSec * 1e8) / 1e8)).toBe(true)
    })
  })

  test('allowedDivisors=[3] produces only 3-based fractions of measureSec (joinProb=0)', () => {
    const measureSec = 9
    const events = generateFullRhythm(3, measureSec, {
      allowedDivisors: [3],
      joinProb: 0,
      restProb: 0,
      minNoteSec: 1.0,
      maxDepth: 10,
    })
    // With ÷3 only and no joining, each duration = 9 / 3^k for some integer k
    events.forEach(e => {
      const logRatio3 = Math.log(measureSec / e.durationSec) / Math.log(3)
      expect(Math.abs(logRatio3 - Math.round(logRatio3))).toBeLessThan(1e-9)
    })
  })

  test('each measure produces at least one event', () => {
    const numMeasures = 12, measureSec = 5.0
    const events = generateFullRhythm(numMeasures, measureSec, { minNoteSec: 0.1, restProb: 0 })
    for (let m = 0; m < numMeasures; m++) {
      const measureStart = m * measureSec
      const inMeasure = events.filter(
        e => e.startSec >= measureStart - 1e-9 && e.startSec < measureStart + measureSec - 1e-9
      )
      expect(inMeasure.length).toBeGreaterThan(0)
    }
  })
})
