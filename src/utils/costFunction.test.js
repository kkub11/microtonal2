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

  it('diagonal (unison) entries have cost 0', () => {
    const t = computeCostTable(scale, edo, primes)
    for (let i = 0; i < N; i++) {
      expect(t[i * N + i]).toBe(0)
    }
  })

  it('perfect fifth costs less than tritone', () => {
    const t = computeCostTable(scale, edo, primes)
    // 0→31 (fifth, ~702¢) vs 0→27 (tritone-ish, ~611¢)
    expect(t[0 * N + 2]).toBeLessThan(t[0 * N + 1])
  })

  it('all non-unison entries are positive', () => {
    const t = computeCostTable(scale, edo, primes)
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i === j) expect(t[i * N + j]).toBe(0)
        else expect(t[i * N + j]).toBeGreaterThan(0)
      }
    }
  })

  it('respects maxPQ parameter — higher maxPQ gives more consonant fifths', () => {
    const t10 = computeCostTable(scale, edo, primes, { maxPQ: 10 })
    const t80 = computeCostTable(scale, edo, primes, { maxPQ: 80 })
    // With more ratios available, the fifth score should be at least as good
    expect(t80[0 * N + 2]).toBeLessThanOrEqual(t10[0 * N + 2])
  })
})
