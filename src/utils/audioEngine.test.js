import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { F_TABLES, parseFTables, buildNoteEvents, AudioEngine } from './audioEngine.js'

// ── F_TABLES ────────────────────────────────────────────────────────────────

describe('F_TABLES', () => {
  test('contains 7 presets (f1–f7)', () => {
    expect(Object.keys(F_TABLES)).toHaveLength(7)
  })

  test('f1 is pure sine [1]', () => {
    expect(F_TABLES.f1).toEqual([1])
  })

  test('all tables start with fundamental amplitude 1', () => {
    Object.values(F_TABLES).forEach(h => expect(h[0]).toBe(1))
  })

  test('richer tables have many harmonics', () => {
    expect(F_TABLES.f2.length).toBeGreaterThan(10)
    expect(F_TABLES.f7.length).toBeGreaterThan(10)
  })
})

// ── parseFTables ─────────────────────────────────────────────────────────────

describe('parseFTables', () => {
  const REF_PATH = resolve(import.meta.dirname, '../../reference/270edo_scale_16_emergent.txt')
  const refText  = readFileSync(REF_PATH, 'utf8')

  test('parses 7 tables from the 270-EDO reference file', () => {
    expect(Object.keys(parseFTables(refText))).toHaveLength(7)
  })

  test('parsed tables match F_TABLES constants', () => {
    const parsed = parseFTables(refText)
    expect(parsed.f1).toEqual(F_TABLES.f1)
    expect(parsed.f2).toEqual(F_TABLES.f2)
    expect(parsed.f7).toEqual(F_TABLES.f7)
  })

  test('ignores non-GEN10 f-statements', () => {
    const text = 'f1 0 4096 10 1\nf2 0 4096 7 0 1\nf3 0 4096 10 1 0.5'
    const parsed = parseFTables(text)
    expect(Object.keys(parsed)).toHaveLength(2)  // f2 skipped (GEN7)
    expect(parsed.f1).toEqual([1])
    expect(parsed.f3).toEqual([1, 0.5])
  })

  test('returns empty object for text with no f-statements', () => {
    expect(parseFTables('; temp = 100; cost = 200\ni3 0 1.0 2.0 1000')).toEqual({})
  })
})

// ── buildNoteEvents ──────────────────────────────────────────────────────────

// 2 voices, 2×2 = 4 score slots per voice, 4-note scale
const scoreShape = [2, 2, 2]
const scoreArray = new Int16Array([
  0, 1, 2, 3,   // voice 0 slots
  3, 2, 1, 0,   // voice 1 slots
])
const scale  = [0, 7, 14, 21]   // 4 evenly-spaced degrees in 28-EDO
const edo    = 28
const baseHz = 72

const rhythm2 = (n) =>
  Array.from({ length: n }, (_, k) => ({ startSec: k * 1.0, durationSec: 1.0, isRest: false }))

describe('buildNoteEvents', () => {
  test('returns one event per rhythm entry per voice', () => {
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [rhythm2(4), rhythm2(4)], baseHz)
    expect(events).toHaveLength(8)
  })

  test('voice indices are correct', () => {
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [rhythm2(4), rhythm2(4)], baseHz)
    expect(events.filter(e => e.voice === 0)).toHaveLength(4)
    expect(events.filter(e => e.voice === 1)).toHaveLength(4)
  })

  test('freqHz = baseHz * 2^(edoStep / edo)', () => {
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [rhythm2(4), rhythm2(4)], baseHz)
    // voice 0, event 0: pitchIdx=0 → edoStep=scale[0]=0 → 72*2^0 = 72
    expect(events[0].freqHz).toBeCloseTo(72)
    // voice 0, event 1: pitchIdx=1 → edoStep=7 → 72*2^(7/28)
    expect(events[1].freqHz).toBeCloseTo(72 * Math.pow(2, 7 / 28))
    // voice 1, event 0: pitchIdx=3 → edoStep=21
    expect(events[4].freqHz).toBeCloseTo(72 * Math.pow(2, 21 / 28))
  })

  test('timing is taken from rhythm', () => {
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [rhythm2(4), rhythm2(4)], baseHz)
    expect(events[0].startSec).toBe(0)
    expect(events[3].startSec).toBe(3.0)
    expect(events[0].durationSec).toBe(1.0)
  })

  test('isRest is preserved from rhythm', () => {
    const rhythmWithRest = [
      [
        { startSec: 0, durationSec: 1.0, isRest: false },
        { startSec: 1, durationSec: 1.0, isRest: true  },
        { startSec: 2, durationSec: 1.0, isRest: false },
        { startSec: 3, durationSec: 1.0, isRest: false },
      ],
      rhythm2(4),
    ]
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo, rhythmWithRest, baseHz)
    const v0 = events.filter(e => e.voice === 0)
    expect(v0.filter(e => e.isRest)).toHaveLength(1)
    expect(v0.filter(e => !e.isRest)).toHaveLength(3)
  })

  test('pitch indices wrap when rhythm events exceed score slots', () => {
    const longRhythm = rhythm2(8)   // 8 events, only 4 score slots
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [longRhythm, []], baseHz)
    const v0 = events.filter(e => e.voice === 0)
    expect(v0).toHaveLength(8)
    // events 4–7 should repeat the same pitches as events 0–3
    for (let i = 0; i < 4; i++) {
      expect(v0[i + 4].freqHz).toBeCloseTo(v0[i].freqHz)
    }
  })

  test('default gainValue is 0.4', () => {
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [rhythm2(4), rhythm2(4)], baseHz)
    events.forEach(e => expect(e.gainValue).toBe(0.4))
  })

  test('gainPerVoice overrides default', () => {
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [rhythm2(4), rhythm2(4)], baseHz, [0.25, 0.75])
    events.filter(e => e.voice === 0).forEach(e => expect(e.gainValue).toBe(0.25))
    events.filter(e => e.voice === 1).forEach(e => expect(e.gainValue).toBe(0.75))
  })

  test('empty rhythm produces no events for that voice', () => {
    const events = buildNoteEvents(scoreArray, scoreShape, scale, edo,
      [[], rhythm2(4)], baseHz)
    expect(events.filter(e => e.voice === 0)).toHaveLength(0)
    expect(events.filter(e => e.voice === 1)).toHaveLength(4)
  })

  test('single-voice score arrays work', () => {
    const singleScore = new Int16Array([0, 1, 2, 3])
    const events = buildNoteEvents(singleScore, [1, 4], scale, edo,
      [rhythm2(4)], baseHz)
    expect(events).toHaveLength(4)
    expect(events.every(e => e.voice === 0)).toBe(true)
  })
})

// ── refreshEvents ───────────────────────────────────────────────────────

// The engine's scheduler state is stubbed directly — no AudioContext is
// needed, because refreshEvents only swaps the event list; it never
// creates an oscillator.
function makePlayingEngine() {
  const engine = new AudioEngine()
  engine._ctx = { currentTime: 100 }  // stub: only the null check reads it
  engine._startTime = 90
  engine._allEvents = [
    { startSec: 0, durationSec: 1, freqHz: 100, voice: 0 },
    { startSec: 1, durationSec: 1, freqHz: 200, voice: 0 },
    { startSec: 2, durationSec: 1, freqHz: 300, voice: 0 },
  ]
  engine._schedIdx = 2  // first two events already scheduled
  engine._totalDuration = 3
  return engine
}

describe('refreshEvents', () => {
  test('swaps freqHz of unscheduled events, preserves _schedIdx', () => {
    const engine = makePlayingEngine()
    const fresh = [
      { startSec: 0, durationSec: 1, freqHz: 110, voice: 0 },
      { startSec: 1, durationSec: 1, freqHz: 210, voice: 0 },
      { startSec: 2, durationSec: 1, freqHz: 310, voice: 0 },
    ]
    expect(engine.refreshEvents(fresh)).toBe(true)
    expect(engine._schedIdx).toBe(2)
    expect(engine._allEvents[2].freqHz).toBe(310)
    expect(engine._totalDuration).toBe(3)
  })

  test('accepts the same events in voice-major (unsorted) order', () => {
    const engine = makePlayingEngine()
    engine._allEvents = [
      { startSec: 0, durationSec: 1, freqHz: 100, voice: 0 },
      { startSec: 0, durationSec: 1, freqHz: 150, voice: 1 },
      { startSec: 1, durationSec: 1, freqHz: 200, voice: 0 },
      { startSec: 1, durationSec: 1, freqHz: 250, voice: 1 },
    ]
    engine._schedIdx = 2
    engine._totalDuration = 2
    const fresh = [
      { startSec: 0, durationSec: 1, freqHz: 101, voice: 0 },
      { startSec: 1, durationSec: 1, freqHz: 201, voice: 0 },
      { startSec: 0, durationSec: 1, freqHz: 151, voice: 1 },
      { startSec: 1, durationSec: 1, freqHz: 251, voice: 1 },
    ]
    expect(engine.refreshEvents(fresh)).toBe(true)
    // Sorted the same way, so the unscheduled tail lines up.
    expect(engine._allEvents[2]).toMatchObject({ startSec: 1, voice: 0, freqHz: 201 })
    expect(engine._allEvents[3]).toMatchObject({ startSec: 1, voice: 1, freqHz: 251 })
  })

  test('returns false when nothing is playing', () => {
    const engine = new AudioEngine()
    expect(engine.refreshEvents([])).toBe(false)
  })

  test('returns false on length mismatch and leaves the list alone', () => {
    const engine = makePlayingEngine()
    const before = engine._allEvents
    expect(engine.refreshEvents([{ startSec: 0, durationSec: 1, freqHz: 1 }])).toBe(false)
    expect(engine._allEvents).toBe(before)
  })

  test('returns false when startSec/durationSec differ', () => {
    const engine = makePlayingEngine()
    const shifted = [
      { startSec: 0, durationSec: 1, freqHz: 110, voice: 0 },
      { startSec: 1, durationSec: 2, freqHz: 210, voice: 0 },
      { startSec: 2, durationSec: 1, freqHz: 310, voice: 0 },
    ]
    expect(engine.refreshEvents(shifted)).toBe(false)
    expect(engine._allEvents[1].freqHz).toBe(200)
  })
})
