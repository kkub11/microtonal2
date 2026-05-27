import { describe, it, expect } from 'vitest'
import { computeCostTable } from './costFunction'

describe('computeCostTable', () => {
  const edo = 53
  const primes = [2, 3, 5]
  // 53-EDO: fifth = 31 steps (~702¢), tritone ≈ 27 steps (~611¢)
  const scale = [0, 27, 31]
  const N = scale.length

  it('returns Float32Array of size N×N', () => {
    const t = computeCostTable(scale, edo, primes)
    expect(t).toBeInstanceOf(Float32Array)
    expect(t.length).toBe(N * N)
  })

  it('diagonal (unison) entries have maximum cost', () => {
    const t = computeCostTable(scale, edo, primes)
    // With primes=[2,3,5] and maxPQ=20 the smallest ratio is 16:15 at ~112¢,
    // which is more than 50¢ from unison (0¢), so score=0 → cost=1/0.001=1000
    const unisonCost = 1.0 / 0.001
    for (let i = 0; i < N; i++) {
      expect(t[i * N + i]).toBeCloseTo(unisonCost, 0)
    }
  })

  it('perfect fifth costs less than tritone', () => {
    const t = computeCostTable(scale, edo, primes)
    // 0→31 (fifth, ~702¢) vs 0→27 (tritone-ish, ~611¢)
    expect(t[0 * N + 2]).toBeLessThan(t[0 * N + 1])
  })

  it('all entries are positive', () => {
    const t = computeCostTable(scale, edo, primes)
    for (let k = 0; k < t.length; k++) {
      expect(t[k]).toBeGreaterThan(0)
    }
  })

  it('respects maxPQ parameter — higher maxPQ gives more consonant fifths', () => {
    const t10 = computeCostTable(scale, edo, primes, { maxPQ: 10 })
    const t80 = computeCostTable(scale, edo, primes, { maxPQ: 80 })
    // With more ratios available, the fifth score should be at least as good
    expect(t80[0 * N + 2]).toBeLessThanOrEqual(t10[0 * N + 2])
  })
})
