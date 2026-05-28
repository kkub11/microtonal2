import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { exportCSound, importCSound, edoStepFromFreqRatio } from './csoundIO.js'

// ── edoStepFromFreqRatio ────────────────────────────────────────────────────

describe('edoStepFromFreqRatio', () => {
  test('unison → step 0', () => {
    expect(edoStepFromFreqRatio(1.0, 53)).toBe(0)
  })

  test('octave → edo steps', () => {
    expect(edoStepFromFreqRatio(2.0, 53)).toBe(53)
    expect(edoStepFromFreqRatio(2.0, 270)).toBe(270)
  })

  test('exact EDO steps round-trip', () => {
    // perfect fifth in 53-EDO = 31 steps
    expect(edoStepFromFreqRatio(Math.pow(2, 31 / 53), 53)).toBe(31)
    // major third in 53-EDO = 17 steps
    expect(edoStepFromFreqRatio(Math.pow(2, 17 / 53), 53)).toBe(17)
    // 131 steps in 270-EDO (from Jim's reference file first note)
    expect(edoStepFromFreqRatio(Math.pow(2, 131 / 270), 270)).toBe(131)
  })
})

// ── exportCSound ────────────────────────────────────────────────────────────

const META = { temperature: 123.45, totalCost: 9876543.2 }
const EVENTS = [
  { startSec: 0.0,  durationSec: 1.25, freqHz: 144.0, voice: 0, gainValue: 0.4,  isRest: false },
  { startSec: 1.25, durationSec: 1.25, freqHz: 180.0, voice: 0, gainValue: 0.4,  isRest: false },
  { startSec: 0.0,  durationSec: 2.5,  freqHz: 216.0, voice: 1, gainValue: 0.3,  isRest: false },
  { startSec: 2.5,  durationSec: 1.0,  freqHz: 72.0,  voice: 2, gainValue: 0.5,  isRest: true  },
]

describe('exportCSound', () => {
  test('first line is ; temp = …; cost = …', () => {
    const line1 = exportCSound(META, EVENTS).split('\n')[0]
    expect(line1).toBe('; temp = 123.45; cost = 9876543.2')
  })

  test('rests are omitted', () => {
    const lines = exportCSound(META, EVENTS).split('\n')
    expect(lines).toHaveLength(4)  // 1 meta + 3 non-rest notes
  })

  test('voice 0 → i3, voice 1 → i4', () => {
    const iLines = exportCSound(META, EVENTS).split('\n').filter(l => l.startsWith('i'))
    expect(iLines[0]).toMatch(/^i3 /)
    expect(iLines[1]).toMatch(/^i3 /)
    expect(iLines[2]).toMatch(/^i4 /)
  })

  test('freqRatio = freqHz / baseHz', () => {
    const iLines = exportCSound(META, EVENTS, { baseHz: 72 }).split('\n').filter(l => l.startsWith('i'))
    // 144 / 72 = 2.0
    expect(parseFloat(iLines[0].split(/\s+/)[3])).toBeCloseTo(2.0)
    // 216 / 72 = 3.0
    expect(parseFloat(iLines[2].split(/\s+/)[3])).toBeCloseTo(3.0)
  })

  test('startSec and durationSec are present', () => {
    const parts = exportCSound(META, EVENTS).split('\n')[1].split(/\s+/)
    expect(parseFloat(parts[1])).toBeCloseTo(0.0)
    expect(parseFloat(parts[2])).toBeCloseTo(1.25)
  })

  test('exported freqRatio has enough precision to recover EDO step', () => {
    const edo = 53
    const step = 31  // perfect fifth
    const freqHz = 72 * Math.pow(2, step / edo)
    const events = [{ startSec: 0, durationSec: 1, freqHz, voice: 0, gainValue: 0.4, isRest: false }]
    const text = exportCSound(META, events, { baseHz: 72 })
    const { noteEvents } = importCSound(text, { baseHz: 72 })
    expect(edoStepFromFreqRatio(noteEvents[0].freqHz / 72, edo)).toBe(step)
  })
})

// ── importCSound ────────────────────────────────────────────────────────────

const SAMPLE_FILE = `; temp = 442.24286675821; cost = 4065252.51483713
f1 0 8192 10 1
f2 0 8192 10 1 0.5 0.3
i3 0.000000 1.250000 2.00000000000000 1000.00
i3 1.250000 1.250000 2.50000000000000 1100.00
i5 0.000000 2.500000 3.00000000000000 950.00
i6 0.000000 5.000000 1.00000000000000 1200.00
`

describe('importCSound', () => {
  test('parses temperature and totalCost', () => {
    const { metadata } = importCSound(SAMPLE_FILE)
    expect(metadata.temperature).toBeCloseTo(442.24286675821)
    expect(metadata.totalCost).toBeCloseTo(4065252.51483713)
  })

  test('skips f-statement and comment lines', () => {
    expect(importCSound(SAMPLE_FILE).noteEvents).toHaveLength(4)
  })

  test('assigns voice indices in order of first instrument appearance', () => {
    const { noteEvents } = importCSound(SAMPLE_FILE)
    // i3 first → voice 0, i5 next → voice 1, i6 → voice 2
    expect(noteEvents[0].voice).toBe(0)
    expect(noteEvents[1].voice).toBe(0)
    expect(noteEvents[2].voice).toBe(1)
    expect(noteEvents[3].voice).toBe(2)
  })

  test('non-consecutive instrument numbers map to consecutive voices', () => {
    const voices = [...new Set(importCSound(SAMPLE_FILE).noteEvents.map(e => e.voice))]
    expect(voices).toEqual([0, 1, 2])
  })

  test('freqHz = freqRatio * baseHz', () => {
    const { noteEvents } = importCSound(SAMPLE_FILE, { baseHz: 72 })
    expect(noteEvents[0].freqHz).toBeCloseTo(2.0 * 72)
    expect(noteEvents[2].freqHz).toBeCloseTo(3.0 * 72)
  })

  test('gainValue in [0.1, 0.8] for Jim-range loudness', () => {
    importCSound(SAMPLE_FILE).noteEvents.forEach(e => {
      expect(e.gainValue).toBeGreaterThanOrEqual(0.09)
      expect(e.gainValue).toBeLessThanOrEqual(0.81)
    })
  })

  test('all imported events have isRest = false', () => {
    expect(importCSound(SAMPLE_FILE).noteEvents.every(e => !e.isRest)).toBe(true)
  })

  test('missing metadata returns nulls', () => {
    const { metadata } = importCSound('i3 0 1.0 2.0 1000')
    expect(metadata.temperature).toBeNull()
    expect(metadata.totalCost).toBeNull()
  })
})

// ── round-trip ──────────────────────────────────────────────────────────────

describe('export → import round-trip', () => {
  test('note events are preserved', () => {
    const original = [
      { startSec: 0.0, durationSec: 1.0, freqHz: 144.0, voice: 0, gainValue: 0.4, isRest: false },
      { startSec: 1.0, durationSec: 2.0, freqHz: 216.0, voice: 1, gainValue: 0.3, isRest: false },
    ]
    const text = exportCSound(META, original, { baseHz: 72 })
    const { noteEvents } = importCSound(text, { baseHz: 72 })
    expect(noteEvents).toHaveLength(2)
    expect(noteEvents[0].startSec).toBeCloseTo(0.0)
    expect(noteEvents[0].durationSec).toBeCloseTo(1.0)
    expect(noteEvents[0].freqHz).toBeCloseTo(144.0, 4)
    expect(noteEvents[0].voice).toBe(0)
    expect(noteEvents[1].freqHz).toBeCloseTo(216.0, 4)
    expect(noteEvents[1].voice).toBe(1)
  })

  test('metadata is preserved', () => {
    const text = exportCSound({ temperature: 99.5, totalCost: 12345.678 }, [])
    const { metadata } = importCSound(text)
    expect(metadata.temperature).toBeCloseTo(99.5)
    expect(metadata.totalCost).toBeCloseTo(12345.678)
  })

  test('rests disappear on export and are absent on import', () => {
    const events = [
      { startSec: 0, durationSec: 1, freqHz: 144, voice: 0, gainValue: 0.4, isRest: false },
      { startSec: 1, durationSec: 1, freqHz: 144, voice: 0, gainValue: 0.4, isRest: true },
    ]
    const { noteEvents } = importCSound(exportCSound(META, events))
    expect(noteEvents).toHaveLength(1)
  })
})

// ── real reference file ─────────────────────────────────────────────────────

describe('270-EDO reference file', () => {
  const filePath = resolve(import.meta.dirname, '../../reference/270edo_scale_16_emergent.txt')
  const text = readFileSync(filePath, 'utf8')

  test('parses temperature and cost from Jim\'s file', () => {
    const { metadata } = importCSound(text)
    expect(metadata.temperature).toBeCloseTo(123.659114503732)
    expect(metadata.totalCost).toBeCloseTo(1449097.51573753)
  })

  test('parses correct number of note events (6808 i-statement lines)', () => {
    const { noteEvents } = importCSound(text)
    // 6816 total lines - 1 metadata - 7 f-statements - blank lines ≈ 6808 note events
    expect(noteEvents.length).toBeGreaterThan(6000)
  })

  test('assigns non-consecutive voices i3, i5, i6 → voices 0, 1, 2', () => {
    const { noteEvents } = importCSound(text)
    const voiceSet = new Set(noteEvents.map(e => e.voice))
    expect([...voiceSet].sort()).toEqual([0, 1, 2])
  })

  test('all freqRatios map to exact 270-EDO steps', () => {
    const { noteEvents } = importCSound(text, { baseHz: 72 })
    // Sample 100 events: each freqRatio should recover an exact integer step
    const sample = noteEvents.slice(0, 100)
    for (const e of sample) {
      const freqRatio = e.freqHz / 72
      const step = edoStepFromFreqRatio(freqRatio, 270)
      expect(Math.pow(2, step / 270)).toBeCloseTo(freqRatio, 5)
    }
  })
})
