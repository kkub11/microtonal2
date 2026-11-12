import { describe, it, expect } from 'vitest'
import {
  computeStrides,
  getNeighborIndices,
  getSequentialNeighbors,
  getPredecessorIndex,
  getThematicNeighbors,
  transposedMatchCost,
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

describe('getSequentialNeighbors', () => {
  const shape = [2, 4]  // 2 voices × 4 positions
  const strides = computeStrides(shape)

  it('returns predecessor and successor in playback order', () => {
    expect(getSequentialNeighbors(1, shape, strides)).toEqual([0, 2])
    expect(getSequentialNeighbors(5, shape, strides)).toEqual([4, 6])
  })

  it('wraps within its own voice', () => {
    // idx=3 is the last position of voice 0: next wraps to 0, stays in voice 0
    expect(getSequentialNeighbors(3, shape, strides)).toEqual([2, 0])
    // idx=7 is the last position of voice 1
    expect(getSequentialNeighbors(7, shape, strides)).toEqual([6, 4])
  })

  it('returns nothing for a single-note voice', () => {
    expect(getSequentialNeighbors(0, [1, 1], computeStrides([1, 1]))).toEqual([])
  })
})

describe('jump and thematic terms', () => {
  // All-zero cost table isolates Terms 3/4 from Term 1.
  const zeroTable = new Float32Array(9)

  it('jump weight penalises leaps and repeats, steps are free (U-shaped)', () => {
    const shape = [1, 4]
    const strides = computeStrides(shape)
    const arr = new Int16Array([0, 0, 0, 0])
    const vs = [{ center: 0, range: 3 }]
    const w = { rangeWeight: 0, jumpWeight: 1, thematicWeight: 0 }
    // idx=1: sequential neighbours arr[0]=0 and arr[2]=0
    // p=1 (a step from both neighbours): free
    expect(computeNoteCost(1, 1, arr, shape, strides, 3, zeroTable, vs, w)).toBe(0)
    // p=0 (repeat of both neighbours): default repeatCost 2.0 × jumpWeight 1, twice
    expect(computeNoteCost(1, 0, arr, shape, strides, 3, zeroTable, vs, w)).toBe(4)
    // p=2 (a leap of 2 from both neighbours): (2-1) × jumpWeight 1, twice
    expect(computeNoteCost(1, 2, arr, shape, strides, 3, zeroTable, vs, w)).toBe(2)
    // With jump weight off, all of it is free
    expect(computeNoteCost(1, 2, arr, shape, strides, 3, zeroTable, vs, { ...w, jumpWeight: 0 })).toBe(0)
    // repeatCost scales the repeat penalty: repeatCost 0.5 → 0.5 × 2 = 1
    expect(computeNoteCost(1, 0, arr, shape, strides, 3, zeroTable, vs, { ...w, repeatCost: 0.5 })).toBe(1)
  })

  it('thematic weight penalises mismatch with long-range neighbours', () => {
    const shape = [1, 3, 3]
    const strides = computeStrides(shape)
    const arr = new Int16Array(9)  // all 0
    const vs = [{ center: 0, range: 3 }]
    const w = { rangeWeight: 0, jumpWeight: 0, thematicWeight: 1 }
    // idx=0: long-range (dim 1) neighbours are arr[3]=0 and arr[6]=0
    expect(computeNoteCost(0, 0, arr, shape, strides, 3, zeroTable, vs, w)).toBe(0)
    expect(computeNoteCost(0, 1, arr, shape, strides, 3, zeroTable, vs, w)).toBe(2)
  })

  it('thematic term is a no-op for shapes with no long-range dim', () => {
    const shape = [1, 4]
    const strides = computeStrides(shape)
    const arr = new Int16Array([0, 0, 0, 0])
    const vs = [{ center: 0, range: 3 }]
    const w = { rangeWeight: 0, jumpWeight: 0, thematicWeight: 5 }
    expect(computeNoteCost(1, 2, arr, shape, strides, 3, zeroTable, vs, w)).toBe(0)
  })

  it('computeTotalCost counts each sequential edge once', () => {
    const shape = [1, 4]
    const strides = computeStrides(shape)
    const vs = [{ center: 0, range: 3 }]
    const w = { rangeWeight: 0, jumpWeight: 1, thematicWeight: 0 }
    expect(computeTotalCost(new Int16Array([0, 0, 0, 0]), shape, strides, 3, zeroTable, vs, w)).toBe(8)
    // Alternating 0,2: four cyclic edges, each a leap of 2 → (2-1) = 1 each
    expect(computeTotalCost(new Int16Array([0, 2, 0, 2]), shape, strides, 3, zeroTable, vs, w)).toBe(4)
    // Alternating 0,1: four cyclic edges, each a step → free
    expect(computeTotalCost(new Int16Array([0, 1, 0, 1]), shape, strides, 3, zeroTable, vs, w)).toBe(0)
  })

  it('computeTotalCost counts each long-range edge once', () => {
    const shape = [1, 3, 3]
    const strides = computeStrides(shape)
    const vs = [{ center: 0, range: 3 }]
    const w = { rangeWeight: 0, jumpWeight: 0, thematicWeight: 1 }
    const arr = new Int16Array(9)
    arr[0] = 1
    // Long-range dim-1 edges touching idx 0: (0,3) and (6,0) — both mismatch
    expect(computeTotalCost(arr, shape, strides, 3, zeroTable, vs, w)).toBe(2)
  })
})

describe('transposed Term 4 (thematicTransposed)', () => {
  // |i-j| table (diagonal 0): a matching interval costs 0, a mismatch
  // costs the degree distance between the actual and expected pitch.
  const N = 7
  const absTable = new Float32Array(N * N)
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) absTable[i * N + j] = Math.abs(i - j)

  it('transposedMatchCost: matching interval is free, mismatch costs the distance', () => {
    // p=4, prev=2 (interval +2); partner 5, partnerPrev 3 (interval +2) → expected 4
    expect(transposedMatchCost(4, 2, 5, 3, N, absTable, 1)).toBe(0)
    // partnerPrev 4 → partner interval +1 → expected 3 → |4-3| = 1
    expect(transposedMatchCost(4, 2, 5, 4, N, absTable, 1)).toBe(1)
    // thematicWeight scales it
    expect(transposedMatchCost(4, 2, 5, 4, N, absTable, 2.5)).toBe(2.5)
  })

  it('transposedMatchCost wraps the expected pitch mod N', () => {
    // prev=6, partner interval +1 → expected 7 → wraps to 0, which equals p
    expect(transposedMatchCost(0, 6, 1, 0, N, absTable, 1)).toBe(0)
    // prev=0, partner interval -1 → expected -1 → wraps to 6, p=0 → |0-6| = 6
    expect(transposedMatchCost(0, 0, 0, 1, N, absTable, 1)).toBe(6)
  })

  it('getThematicNeighbors returns the long-range dims only', () => {
    const shape = [1, 4, 4]
    const strides = computeStrides(shape)
    // idx=5 (dim1 pos 1): dim-1 neighbours are idx 9 (+4) and idx 1 (-4)
    expect(getThematicNeighbors(5, shape, strides).sort((a, b) => a - b)).toEqual([1, 9])
    // No long-range dim in a 2-dim shape
    expect(getThematicNeighbors(1, [1, 4], computeStrides([1, 4]))).toEqual([])
  })

  it('getPredecessorIndex wraps within its voice, -1 for a single note', () => {
    const strides = computeStrides([1, 4, 4])
    expect(getPredecessorIndex(5, [1, 4, 4], strides)).toBe(4)
    expect(getPredecessorIndex(0, [1, 4, 4], strides)).toBe(15)
    expect(getPredecessorIndex(0, [1, 1], computeStrides([1, 1]))).toBe(-1)
  })

  it('computeNoteCost rewards a matching interval, penalises a mismatch', () => {
    const shape = [1, 4, 4]
    const strides = computeStrides(shape)
    const vs = [{ center: 3, range: N }]
    const w = { rangeWeight: 0, jumpWeight: 0, thematicWeight: 1, thematicTransposed: true }
    // idx=5: predecessor arr[4]=2, candidate p=4 (interval +2).
    // Partner 1 (arr[1]=5) with predecessor arr[0]: interval +2 when
    // arr[0]=3 (matches) and +1 when arr[0]=4 (mismatch).
    // Partner 9 (arr[9]=1) with predecessor arr[8]=0: interval +1
    // (mismatch in both arrays, cost 1). arr[0] is not a Term 1 or
    // sequential neighbour of idx 5, so only Term 4 differs.
    const base = new Int16Array(16)
    base[4] = 2; base[1] = 5; base[9] = 1; base[8] = 0
    const arrMatch = base.slice(); arrMatch[0] = 3
    const arrMismatch = base.slice(); arrMismatch[0] = 4
    // Term 1 (always on) is 10 in both arrays: |4-5|+|4-1|+|4-2|+|4-0|.
    // Term 4 is 1 (match) vs 2 (mismatch) — the difference is exactly
    // the one mismatched interval.
    expect(computeNoteCost(5, 4, arrMatch, shape, strides, N, absTable, vs, w)).toBe(11)
    expect(computeNoteCost(5, 4, arrMismatch, shape, strides, N, absTable, vs, w)).toBe(12)
    // Control: with the simple (non-transposed) rule both arrays cost
    // the same — it only looks at whether the partner pitch equals p.
    const wSimple = { ...w, thematicTransposed: false }
    expect(computeNoteCost(5, 4, arrMatch, shape, strides, N, absTable, vs, wSimple))
      .toBe(computeNoteCost(5, 4, arrMismatch, shape, strides, N, absTable, vs, wSimple))
  })

  it('computeTotalCost sums the directed transposed term (both directions)', () => {
    // 0/1 table: a directed edge costs 1 iff p differs from its expected pitch.
    const N3 = 3
    const table01 = new Float32Array(N3 * N3)
    for (let i = 0; i < N3; i++) for (let j = 0; j < N3; j++) table01[i * N3 + j] = i === j ? 0 : 1
    const shape = [1, 4, 4]
    const strides = computeStrides(shape)
    const vs = [{ center: 1, range: N3 }]
    const w = { rangeWeight: 0, jumpWeight: 0, thematicWeight: 1, thematicTransposed: true }
    const arr = new Int16Array([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0])
    // Independent enumeration with raw index arithmetic (no helpers).
    // Term 1 (always on, counted once per +1 edge in dims 1 and 2) plus
    // the directed Term 4 (both directions of every long-range edge).
    let expectedTotal = 0
    for (let idx = 0; idx < 16; idx++) {
      // Term 1: +1 neighbours in dim 1 (stride 4, size 4) and dim 2 (stride 1, size 4)
      for (const [stride, dk] of [[4, 4], [1, 4]]) {
        const pos = Math.floor(idx / stride) % dk
        const ni = idx - pos * stride + ((pos + 1) % dk) * stride
        if (arr[ni] !== arr[idx]) expectedTotal++
      }
      // Term 4: thematic neighbours are ±4 in the flat voice (dim 1,
      // size 4), predecessor is -1 mod 16. Expected pitch wraps mod 3.
      for (const ni of [(idx + 4) % 16, (idx + 12) % 16]) {
        const expected = (((arr[(idx + 15) % 16] + (arr[ni] - arr[(ni + 15) % 16])) % 3) + 3) % 3
        if (arr[idx] !== expected) expectedTotal++
      }
    }
    expect(computeTotalCost(arr, shape, strides, N3, table01, vs, w)).toBe(expectedTotal)
    expect(expectedTotal).toBeGreaterThan(0) // the test array is not trivially matched
  })
})
