import { describe, test, expect } from 'vitest'
import { traversalToDegrees, scaleCycleDegrees, detectTransition } from './twoPhaseUtils'

describe('traversalToDegrees', () => {
  const scale = [0, 9, 18, 27, 31, 40, 49]
  const x = { ratio: [3, 2] }
  const y = { ratio: [5, 4] }

  test('syntonic comma 81/80 in 53-EDO gives the 6-step traversal in scale degrees', () => {
    const degrees = traversalToDegrees({ monzo: [-4, 4, -1, 0, 0, 0] }, scale, 53, x, y)
    expect(degrees).toEqual([0, 4, 1, 6, 3, 0])
  })

  test('all degrees are valid scale degrees', () => {
    const degrees = traversalToDegrees({ monzo: [-4, 4, -1, 0, 0, 0] }, scale, 53, x, y)
    for (const d of degrees) {
      expect(Number.isInteger(d)).toBe(true)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThan(7)
    }
  })

  test('null when no comma or no scale', () => {
    expect(traversalToDegrees(null, scale, 53, x, y)).toBeNull()
    expect(traversalToDegrees({ monzo: [-4, 4, -1, 0, 0, 0] }, [], 53, x, y)).toBeNull()
    expect(traversalToDegrees({ monzo: [-4, 4, -1, 0, 0, 0] }, scale, 53, null, y)).toBeNull()
  })

  test('works on a 5-note scale (degrees wrap to valid range)', () => {
    const degrees = traversalToDegrees(
      { monzo: [-4, 4, -1, 0, 0, 0] }, [0, 9, 18, 31, 40], 53, x, y)
    expect(degrees.length).toBeGreaterThan(0)
    for (const d of degrees) expect(d).toBeLessThan(5)
  })
})

describe('scaleCycleDegrees', () => {
  test('returns 0..N-1', () => {
    expect(scaleCycleDegrees([0, 9, 18, 27, 31, 40, 49])).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(scaleCycleDegrees([])).toEqual([])
  })
})

describe('detectTransition', () => {
  // Build a history from (T, cost) pairs, several points per temperature
  // to mimic dense PROGRESS readings, with a little noise.
  function history(pairs, perT = 3, noise = 0) {
    const out = []
    let s = 42
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
    for (const [t, c] of pairs) {
      for (let i = 0; i < perT; i++) {
        out.push({ temperature: t * (1 + (rnd() - 0.5) * 0.01), cost: c * (1 + (rnd() - 0.5) * noise) })
      }
    }
    return out
  }

  test('sharp knuckle: detects near the drop', () => {
    const h = history([
      [200, 8000], [160, 7900], [130, 7800], [100, 7600],
      [80, 5000], [64, 4200], [50, 3600], [40, 3300], [30, 3100],
    ], 3, 0.02)
    const t = detectTransition(h)
    expect(t).not.toBeNull()
    expect(t).toBeGreaterThanOrEqual(50)
    expect(t).toBeLessThanOrEqual(100)
  })

  test('gradual decline: no detection (no knuckle)', () => {
    const h = history([
      [200, 8000], [160, 7600], [130, 7200], [100, 6800],
      [80, 6400], [64, 6000], [50, 5600], [40, 5200], [30, 4800],
    ], 3, 0.02)
    expect(detectTransition(h)).toBeNull()
  })

  test('flat cost: no detection', () => {
    const h = history([
      [200, 5000], [160, 5000], [130, 5000], [100, 5000],
      [80, 5000], [64, 5000], [50, 5000], [40, 5000],
    ], 3, 0.01)
    expect(detectTransition(h)).toBeNull()
  })

  test('too few points: null', () => {
    expect(detectTransition(history([[200, 8000], [100, 4000]], 2))).toBeNull()
    expect(detectTransition([])).toBeNull()
  })

  test('drop that is too small: null', () => {
    const h = history([
      [200, 8000], [160, 7900], [130, 7800], [100, 7700],
      [80, 7600], [64, 7500], [50, 7400], [40, 7300],
    ], 3, 0.01)
    expect(detectTransition(h)).toBeNull()
  })
})
