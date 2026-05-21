import { describe, it, expect } from 'vitest'
import {
  parseCommasText,
  monzoToRatio,
  monzoToCents,
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

describe('filterCommas', () => {
  const commas = [
    { monzo: [-4, 4, -1, 0, 0, 0], bestEdo: 53 },  // 5-limit, 53-EDO
    { monzo: [-6, 1, 0, 1, 0, 0],  bestEdo: 31 },  // 7-limit, 31-EDO (out of range)
    { monzo: [0, -2, 0, 0, 1, 0],  bestEdo: 53 },  // 11-limit, 53-EDO
    { monzo: [1, 0, -1, 1, 0, 0],  bestEdo: 53 },  // 7-limit, 53-EDO
  ]

  it('keeps only 5-limit commas when primes=[2,3,5]', () => {
    const result = filterCommas(commas, [2, 3, 5], 53)
    expect(result).toHaveLength(1)
    expect(result[0].monzo).toEqual([-4, 4, -1, 0, 0, 0])
  })

  it('keeps 5- and 7-limit when primes=[2,3,5,7], filters 11-limit and wrong EDO', () => {
    const result = filterCommas(commas, [2, 3, 5, 7], 53)
    expect(result).toHaveLength(2)
    const monzos = result.map(c => c.monzo)
    expect(monzos).toContainEqual([-4, 4, -1, 0, 0, 0])
    expect(monzos).toContainEqual([1, 0, -1, 1, 0, 0])
  })

  it('excludes commas whose bestEdo is outside the tolerance window', () => {
    const result = filterCommas(commas, [2, 3, 5, 7], 53)
    expect(result.every(c => c.bestEdo !== 31)).toBe(true)
  })

  it('accepts custom tolerance', () => {
    // 31-EDO is ~41% away from 53 so 0.5 tolerance should include it
    const result = filterCommas(commas, [2, 3, 5, 7], 53, 0.5)
    expect(result.some(c => c.bestEdo === 31)).toBe(true)
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
