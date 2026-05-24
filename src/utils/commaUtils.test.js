import { describe, it, expect } from 'vitest'
import {
  parseCommasText,
  monzoToRatio,
  monzoToCents,
  isTempered,
  getCommaName,
  filterCommas,
  commaToTonnetzPath,
} from './commaUtils'

describe('parseCommasText', () => {
  it('parses basic lines', () => {
    const result = parseCommasText('[4 -4 1 0 0 0 > 43\n[19 -12 0 0 0 0 > 12')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ monzo: [4, -4, 1, 0, 0, 0], bestEdo: 43 })
    expect(result[1]).toEqual({ monzo: [19, -12, 0, 0, 0, 0], bestEdo: 12 })
  })

  it('skips blank and malformed lines', () => {
    const result = parseCommasText('[4 -4 1 0 0 0 > 43\n\nbad line\n[19 -12 0 0 0 0 > 12')
    expect(result).toHaveLength(2)
  })
})

describe('monzoToRatio', () => {
  it('syntonic comma 81/80', () => {
    // [-4, 4, -1] = 2^-4 * 3^4 * 5^-1 = 81/80
    const { numerator, denominator } = monzoToRatio([-4, 4, -1, 0, 0, 0])
    expect(numerator).toBe(81n)
    expect(denominator).toBe(80n)
  })

  it('perfect fifth 3/2', () => {
    const { numerator, denominator } = monzoToRatio([-1, 1, 0, 0, 0, 0])
    expect(numerator).toBe(3n)
    expect(denominator).toBe(2n)
  })

  it('unison', () => {
    const { numerator, denominator } = monzoToRatio([0, 0, 0, 0, 0, 0])
    expect(numerator).toBe(1n)
    expect(denominator).toBe(1n)
  })

  it('handles large exponents (Pythagorean comma 531441/524288)', () => {
    // [-19, 12] = 3^12/2^19
    const { numerator, denominator } = monzoToRatio([-19, 12, 0, 0, 0, 0])
    expect(numerator).toBe(531441n)
    expect(denominator).toBe(524288n)
  })
})

describe('monzoToCents', () => {
  it('octave = 1200 cents', () => {
    expect(monzoToCents([1, 0, 0, 0, 0, 0])).toBeCloseTo(1200, 5)
  })

  it('perfect fifth ≈ 701.955 cents', () => {
    expect(monzoToCents([-1, 1, 0, 0, 0, 0])).toBeCloseTo(701.955, 2)
  })

  it('syntonic comma ≈ 21.506 cents', () => {
    expect(monzoToCents([-4, 4, -1, 0, 0, 0])).toBeCloseTo(21.506, 2)
  })

  it('Pythagorean comma ≈ 23.460 cents', () => {
    expect(monzoToCents([-19, 12, 0, 0, 0, 0])).toBeCloseTo(23.460, 2)
  })

  it('unison = 0 cents', () => {
    expect(monzoToCents([0, 0, 0, 0, 0, 0])).toBe(0)
  })
})

describe('isTempered', () => {
  it('schisma is tempered by 53-EDO', () => {
    // [-15,8,1]: -15×53 + 8×84 + 1×123 = -795+672+123 = 0
    expect(isTempered([-15, 8, 1, 0, 0, 0], 53)).toBe(true)
  })

  it('kleisma is tempered by 53-EDO', () => {
    // [-6,-5,6]: -6×53 + (-5)×84 + 6×123 = -318-420+738 = 0
    expect(isTempered([-6, -5, 6, 0, 0, 0], 53)).toBe(true)
  })

  it('syntonic comma is NOT tempered by 53-EDO (53 keeps it)', () => {
    // [-4,4,-1]: -4×53 + 4×84 + (-1)×123 = -212+336-123 = 1 ≠ 0
    expect(isTempered([-4, 4, -1, 0, 0, 0], 53)).toBe(false)
  })

  it('syntonic comma IS tempered by 12-EDO', () => {
    // [-4,4,-1]: -4×12 + 4×19 + (-1)×28 = -48+76-28 = 0
    expect(isTempered([-4, 4, -1, 0, 0, 0], 12)).toBe(true)
  })

  it('Pythagorean comma is tempered by 12-EDO', () => {
    expect(isTempered([-19, 12, 0, 0, 0, 0], 12)).toBe(true)
  })

  it('marvel comma is tempered by 53-EDO', () => {
    // [-5,2,2,-1]: -5×53 + 2×84 + 2×123 + (-1)×149 = -265+168+246-149 = 0
    expect(isTempered([-5, 2, 2, -1, 0, 0], 53)).toBe(true)
  })
})

describe('getCommaName', () => {
  it('identifies schisma', () => {
    expect(getCommaName([-15, 8, 1, 0, 0, 0])).toBe('Schisma')
  })

  it('identifies schisma inverse', () => {
    expect(getCommaName([15, -8, -1, 0, 0, 0])).toBe('Schisma')
  })

  it('identifies syntonic comma', () => {
    expect(getCommaName([-4, 4, -1, 0, 0, 0])).toBe('Syntonic comma')
  })

  it('returns null for unknown comma', () => {
    expect(getCommaName([-15, 8, 1, 0, 0, 1])).toBeNull()
  })
})

describe('filterCommas', () => {
  // Fixture: commas with known temperament properties
  const commas = [
    { monzo: [-15, 8, 1, 0, 0, 0],  bestEdo: 53 }, // schisma — 5-limit, tempered by 53
    { monzo: [-6, -5, 6, 0, 0, 0],  bestEdo: 53 }, // kleisma — 5-limit, tempered by 53
    { monzo: [-4, 4, -1, 0, 0, 0],  bestEdo: 12 }, // syntonic comma — 5-limit, NOT by 53
    { monzo: [-5, 2, 2, -1, 0, 0],  bestEdo: 31 }, // marvel comma — 7-limit, tempered by 53
    { monzo: [0, -2, 0, 0, 1, 0],   bestEdo: 53 }, // 11-limit — NOT tempered by 53
  ]

  it('returns 5-limit commas tempered by 53-EDO (schisma + kleisma)', () => {
    const result = filterCommas(commas, [2, 3, 5], 53)
    expect(result).toHaveLength(2)
    const monzos = result.map(c => c.monzo)
    expect(monzos).toContainEqual([-15, 8, 1, 0, 0, 0])
    expect(monzos).toContainEqual([-6, -5, 6, 0, 0, 0])
  })

  it('adds marvel comma when prime 7 is included', () => {
    const result = filterCommas(commas, [2, 3, 5, 7], 53)
    expect(result).toHaveLength(3)
    expect(result.map(c => c.monzo)).toContainEqual([-5, 2, 2, -1, 0, 0])
  })

  it('excludes syntonic comma for 53-EDO (not tempered)', () => {
    const result = filterCommas(commas, [2, 3, 5], 53)
    expect(result.every(c => c.monzo.join() !== '-4,4,-1,0,0,0')).toBe(true)
  })

  it('returns syntonic comma for 12-EDO', () => {
    const result = filterCommas(commas, [2, 3, 5], 12)
    expect(result.some(c => c.monzo.join() === '-4,4,-1,0,0,0')).toBe(true)
  })

  it('excludes 7-limit commas when primes=[2,3,5]', () => {
    const result = filterCommas(commas, [2, 3, 5], 53)
    expect(result.every(c => c.monzo[3] === 0)).toBe(true)
  })

  it('excludes 11-limit commas not tempered by EDO', () => {
    const result = filterCommas(commas, [2, 3, 5, 7, 11], 53)
    expect(result.every(c => JSON.stringify(c.monzo) !== JSON.stringify([0, -2, 0, 0, 1, 0]))).toBe(true)
  })
})

describe('commaToTonnetzPath', () => {
  const P5 = { ratio: [3, 2] }
  const M3 = { ratio: [5, 4] }

  it('syntonic comma = 4 fifths − 1 major third', () => {
    // 81/80 = (3/2)^4 / (5/4)  → path vector (+4 fifths, −1 third)
    const path = commaToTonnetzPath([-4, 4, -1, 0, 0, 0], P5, M3)
    const dx = path.reduce((s, [x]) => s + x, 0)
    const dy = path.reduce((s, [, y]) => s + y, 0)
    expect(dx).toBe(4)
    expect(dy).toBe(-1)
  })

  it('returns unit steps', () => {
    const path = commaToTonnetzPath([-4, 4, -1, 0, 0, 0], P5, M3)
    expect(path.length).toBe(5)  // |4| + |-1|
    path.forEach(([x, y]) => {
      expect(Math.abs(x) + Math.abs(y)).toBe(1)  // exactly one unit step each
    })
  })

  it('unison comma → empty path', () => {
    const path = commaToTonnetzPath([0, 0, 0, 0, 0, 0], P5, M3)
    expect(path).toHaveLength(0)
  })
})
