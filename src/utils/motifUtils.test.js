import { describe, test, expect } from 'vitest'
import {
  PRESET_MOTIFS, MAX_MOTIF_NOTES, DEFAULT_PRESET_ID,
  getPresetMotif, resolveMotif, normalizeDegrees,
  seedScoreWithMotif, motifDegreeToHz,
} from './motifUtils'

describe('PRESET_MOTIFS', () => {
  test('every preset has a unique id, a genre, and non-empty integer degrees >= 0', () => {
    const ids = new Set()
    for (const m of PRESET_MOTIFS) {
      expect(m.id).toBeTruthy()
      expect(ids.has(m.id)).toBe(false)
      ids.add(m.id)
      expect(m.genre).toBeTruthy()
      expect(m.degrees.length).toBeGreaterThan(0)
      expect(m.degrees.length).toBeLessThanOrEqual(MAX_MOTIF_NOTES)
      for (const d of m.degrees) expect(Number.isInteger(d)).toBe(true)
      expect(Math.min(...m.degrees)).toBeGreaterThanOrEqual(0)
    }
  })

  test('default preset exists', () => {
    expect(getPresetMotif(DEFAULT_PRESET_ID)).not.toBeNull()
  })

  test('presets span several genres', () => {
    const genres = new Set(PRESET_MOTIFS.map(m => m.genre))
    expect(genres.size).toBeGreaterThanOrEqual(5)
  })
})

describe('resolveMotif', () => {
  test('null when disabled', () => {
    expect(resolveMotif({ enabled: false, source: 'preset', presetId: 'beethoven5' })).toBeNull()
    expect(resolveMotif(null)).toBeNull()
    expect(resolveMotif(undefined)).toBeNull()
  })

  test('returns preset degrees when enabled', () => {
    expect(resolveMotif({ enabled: true, source: 'preset', presetId: 'beethoven5' }))
      .toEqual([4, 4, 4, 2])
  })

  test('returns custom degrees when source is custom', () => {
    expect(resolveMotif({ enabled: true, source: 'custom', customDegrees: [0, 2, 4] }))
      .toEqual([0, 2, 4])
  })

  test('null when custom motif is empty', () => {
    expect(resolveMotif({ enabled: true, source: 'custom', customDegrees: [] })).toBeNull()
  })

  test('returns a copy, not the preset array itself', () => {
    const degrees = resolveMotif({ enabled: true, source: 'preset', presetId: 'beethoven5' })
    degrees[0] = 99
    expect(getPresetMotif('beethoven5').degrees[0]).toBe(4)
  })
})

describe('normalizeDegrees', () => {
  test('wraps degrees >= N and negatives into 0..N-1', () => {
    expect(normalizeDegrees([0, 4, 5, 6, 7, -1], 5)).toEqual([0, 4, 0, 1, 2, 4])
  })

  test('empty input stays empty', () => {
    expect(normalizeDegrees([], 7)).toEqual([])
  })
})

describe('seedScoreWithMotif', () => {
  test('plants the motif at the start of every voice, transposed +2 per voice', () => {
    const shape = [3, 4, 4, 4] // 3 voices x 64
    const arr = new Int16Array(3 * 64).fill(9)
    const written = seedScoreWithMotif(arr, shape, [0, 2, 4], 7)
    // voice 0: [0,2,4] at 0; voice 1: [2,4,6] at 64; voice 2: [4,6,1] at 128
    expect([...arr.slice(0, 3)]).toEqual([0, 2, 4])
    expect([...arr.slice(64, 67)]).toEqual([2, 4, 6])
    expect([...arr.slice(128, 131)]).toEqual([4, 6, 1])
    expect(written).toBeGreaterThanOrEqual(9)
  })

  test('plants a second copy halfway through each voice when it fits', () => {
    const shape = [2, 4, 4, 4] // 2 voices x 64
    const arr = new Int16Array(2 * 64).fill(9)
    seedScoreWithMotif(arr, shape, [0, 2, 4], 7)
    expect([...arr.slice(32, 35)]).toEqual([0, 2, 4])
    expect([...arr.slice(96, 99)]).toEqual([2, 4, 6])
  })

  test('wraps degrees mod N for small scales', () => {
    const shape = [1, 4, 4, 4]
    const arr = new Int16Array(64).fill(9)
    seedScoreWithMotif(arr, shape, [0, 2, 4, 6], 5)
    expect([...arr.slice(0, 4)]).toEqual([0, 2, 4, 1])
  })

  test('truncates safely when the motif is longer than a voice', () => {
    const shape = [1, 2, 2] // voice length 4
    const arr = new Int16Array(4).fill(9)
    const written = seedScoreWithMotif(arr, shape, [0, 1, 2, 3, 4, 5], 7)
    expect([...arr]).toEqual([0, 1, 2, 3])
    expect(written).toBe(4)
  })

  test('empty motif writes nothing', () => {
    const arr = new Int16Array(64).fill(9)
    expect(seedScoreWithMotif(arr, [2, 4, 4, 4], [], 7)).toBe(0)
    expect(arr.every(v => v === 9)).toBe(true)
  })

  test('records planted positions in the pinned set when given', () => {
    const shape = [2, 4, 4, 4] // 2 voices x 64
    const arr = new Int16Array(2 * 64).fill(9)
    const pinned = new Set()
    const written = seedScoreWithMotif(arr, shape, [0, 2, 4], 7, pinned)
    expect(pinned.size).toBe(written)
    // start of each voice + halfway copy
    expect(pinned.has(0)).toBe(true)
    expect(pinned.has(32)).toBe(true)
    expect(pinned.has(64)).toBe(true)
    expect(pinned.has(96)).toBe(true)
    // a non-planted position is not pinned
    expect(pinned.has(10)).toBe(false)
  })

  test('empty motif leaves the pinned set empty', () => {
    const arr = new Int16Array(64).fill(9)
    const pinned = new Set()
    seedScoreWithMotif(arr, [2, 4, 4, 4], [], 7, pinned)
    expect(pinned.size).toBe(0)
  })

  test('does not write outside the array', () => {
    const shape = [2, 2, 2] // total 8, voice length 4
    const arr = new Int16Array(8).fill(9)
    seedScoreWithMotif(arr, shape, [0, 1, 2, 3, 4, 5, 6], 7)
    expect(arr.length).toBe(8)
  })
})

describe('motifDegreeToHz', () => {
  test('is monotonic in degree and returns the root for degree 0', () => {
    const scale = [0, 9, 18, 27, 31, 40, 49]
    expect(motifDegreeToHz(0, scale, 53, 131)).toBeCloseTo(131, 6)
    const hz = scale.map((_, d) => motifDegreeToHz(d, scale, 53, 131))
    for (let i = 1; i < hz.length; i++) expect(hz[i]).toBeGreaterThan(hz[i - 1])
  })
})
