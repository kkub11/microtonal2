import { describe, it, expect } from 'vitest'
import {
  computeStrides,
  getNeighborIndices,
  computeNoteCost,
  computeTotalCost,
  pickPitch,
} from './annealing'

// Minimal 3-note scale cost table: 3×3 Float32Array.
// Unison (diagonal) = 100, perfect interval (±1 step) = 2, tritone-ish (±2) = 8.
function makeCostTable() {
  const N = 3
  const t = new Float32Array(N * N)
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const d = Math.min(Math.abs(i - j), N - Math.abs(i - j))
      t[i * N + j] = d === 0 ? 100 : d === 1 ? 2 : 8
    }
  }
  return t
}

describe('computeStrides', () => {
  it('computes correct strides for [3,6,6,6]', () => {
    expect(computeStrides([3, 6, 6, 6])).toEqual([216, 36, 6, 1])
  })

  it('single element', () => {
    expect(computeStrides([1])).toEqual([1])
  })

  it('flat shape', () => {
    expect(computeStrides([4, 3])).toEqual([3, 1])
  })
})

describe('getNeighborIndices', () => {
  const shape = [2, 3]  // 2 voices × 3 positions
  const strides = computeStrides(shape)

  it('wraps correctly in second dimension', () => {
    // idx=1 (voice 0, pos 1): neighbors in dim1 are pos 2 (idx=2) and pos 0 (idx=0)
    const ns = getNeighborIndices(1, shape, strides)
    expect(ns).toContain(2)
    expect(ns).toContain(0)
  })

  it('wraps around the edge (pos 0 → pos 2 and pos 1)', () => {
    // idx=0 (voice 0, pos 0): neighbours include pos 1 (idx 1) and pos 2 (idx 2, wrap)
    const ns = getNeighborIndices(0, shape, strides)
    expect(ns).toContain(1)
    expect(ns).toContain(2)
  })

  it('returns 2×ndim neighbours when no degenerate dims', () => {
    const shape3 = [2, 3, 4]
    const s3 = computeStrides(shape3)
    expect(getNeighborIndices(0, shape3, s3)).toHaveLength(6)
  })

  it('skips degenerate (size-1) dimensions', () => {
    const ns = getNeighborIndices(0, [1, 3], computeStrides([1, 3]))
    expect(ns).toHaveLength(2)  // only the non-degenerate dim contributes
  })
})

describe('computeNoteCost', () => {
  const N = 3
  const costTable = makeCostTable()
  const shape = [1, 3]            // 1 voice, 3 positions (ring)
  const strides = computeStrides(shape)
  const voiceSettings = [{ center: 1, range: N }]
  const weights = { rangeWeight: 1.0 }

  it('all-same pitch has high neighbour cost (unison)', () => {
    const arr = new Int16Array([0, 0, 0])
    // pitch=0, neighbours are at pos1(=0) and pos2(=0)
    const cost = computeNoteCost(0, 0, arr, shape, strides, N, costTable, voiceSettings, weights)
    // Term1: 2 neighbours × costTable[0*3+0]=100
    // Term2: dist(0,center=1)=1 → 1*1=1
    expect(cost).toBe(2 * 100 + 1)
  })

  it('cost decreases when placed at center pitch', () => {
    const arr = new Int16Array([0, 0, 0])
    const costOff = computeNoteCost(0, 0, arr, shape, strides, N, costTable, voiceSettings, weights)
    const costCenter = computeNoteCost(0, 1, arr, shape, strides, N, costTable, voiceSettings, weights)
    // pitch=1 has range cost 0 (at center), pitch=0 has range cost 1
    expect(costCenter).toBeLessThan(costOff)
  })
})

describe('computeTotalCost', () => {
  const N = 3
  const costTable = makeCostTable()
  const shape = [1, 3]
  const strides = computeStrides(shape)
  const voiceSettings = [{ center: 1, range: N }]
  const weights = { rangeWeight: 0.0 }  // ignore range for this test

  it('uniform array: all edges counted once (+1 direction only)', () => {
    const arr = new Int16Array([0, 0, 0])
    // 3 positions in the ring, each has one +1 neighbour
    // Each edge: costTable[0*3+0] = 100; 3 edges total
    expect(computeTotalCost(arr, shape, strides, N, costTable, voiceSettings, weights)).toBe(300)
  })

  it('lower for consonant pitches', () => {
    const arrBad  = new Int16Array([0, 0, 0])      // all unison
    const arrGood = new Int16Array([0, 1, 2])       // consecutive (cheap)
    const badCost  = computeTotalCost(arrBad,  shape, strides, N, costTable, voiceSettings, { rangeWeight: 0 })
    const goodCost = computeTotalCost(arrGood, shape, strides, N, costTable, voiceSettings, { rangeWeight: 0 })
    expect(goodCost).toBeLessThan(badCost)
  })
})

describe('pickPitch', () => {
  const N = 3
  const costTable = makeCostTable()
  const shape = [1, 3]
  const strides = computeStrides(shape)
  const voiceSettings = [{ center: 1, range: N }]
  const weights = { rangeWeight: 0.0 }

  it('at very low T, consistently picks the cheapest pitch', () => {
    // arr=[0, 1, 2]: for idx=0, neighbours are arr[1]=1 and arr[2]=2
    // cost(p=0): ct[0*3+1]=2 + ct[0*3+2]=8 = 10
    // cost(p=1): ct[1*3+1]=100 + ct[1*3+2]=2 = 102
    // cost(p=2): ct[2*3+1]=2 + ct[2*3+2]=8 = 10
    // p=0 and p=2 are tied; p=1 is most expensive → should virtually never be picked
    const arr = new Int16Array([0, 1, 2])
    const T = 0.001
    const counts = [0, 0, 0]
    for (let i = 0; i < 100; i++) counts[pickPitch(0, arr, shape, strides, N, costTable, voiceSettings, weights, T)]++
    expect(counts[1]).toBe(0)
  })

  it('at very high T, picks all pitches roughly equally', () => {
    const arr = new Int16Array([0, 1, 2])
    const T = 1e9
    const counts = [0, 0, 0]
    for (let i = 0; i < 3000; i++) counts[pickPitch(0, arr, shape, strides, N, costTable, voiceSettings, weights, T)]++
    // Each pitch should appear ~1000 times; allow generous margin
    for (let p = 0; p < N; p++) expect(counts[p]).toBeGreaterThan(500)
  })

  it('always returns a valid pitch index', () => {
    const arr = new Int16Array([1, 2, 0])
    for (let i = 0; i < 50; i++) {
      const p = pickPitch(2, arr, shape, strides, N, costTable, voiceSettings, weights, 10)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(N)
    }
  })
})
