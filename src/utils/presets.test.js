import { describe, it, expect } from 'vitest'
import {
  BUILTIN_PRESETS, DEFAULT_SETTINGS, validateSettings,
  serializeSettingsFile, parseSettingsFile, settingsFromState,
  loadUserPresets, saveUserPreset, deleteUserPreset, makeUserPresetId,
} from './presets.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, v) },
    removeItem: k => { map.delete(k) },
  }
}

describe('built-in presets', () => {
  it('every built-in preset validates and has a scale', () => {
    expect(BUILTIN_PRESETS.length).toBeGreaterThanOrEqual(4)
    for (const p of BUILTIN_PRESETS) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/)
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.blurb.length).toBeGreaterThan(10)
      const v = validateSettings(p.settings)
      expect(v.ok).toBe(true)
      expect(v.settings.scale).not.toBeNull()
      expect(v.settings.scale.length).toBeGreaterThanOrEqual(5)
      expect(p.waveform).toMatch(/^f\d+$/)
      expect(p.snapshotHint).toContain('T')
    }
  })

  it('preset ids are unique', () => {
    const ids = BUILTIN_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('Storyteller carries the Ode to Joy motif and transposed Term 4', () => {
    const p = BUILTIN_PRESETS.find(x => x.id === 'storyteller')
    expect(p.settings.motif.enabled).toBe(true)
    expect(p.settings.motif.presetId).toBe('ode-to-joy')
    expect(p.settings.weights.thematicTransposed).toBe(true)
    expect(p.settings.weights.thematicWeight).toBe(2.0)
  })

  it('Calm is the 2-voice pentatonic, Solo is 1 voice', () => {
    const calm = BUILTIN_PRESETS.find(x => x.id === 'calm')
    expect(calm.settings.voiceCount).toBe(2)
    expect(calm.settings.scale).toEqual([0, 9, 18, 31, 40])
    const solo = BUILTIN_PRESETS.find(x => x.id === 'solo')
    expect(solo.settings.voiceCount).toBe(1)
  })
})

describe('validateSettings', () => {
  it('fills defaults for missing fields', () => {
    const v = validateSettings({ edo: 31 })
    expect(v.ok).toBe(true)
    expect(v.settings.edo).toBe(31)
    expect(v.settings.primes).toEqual(DEFAULT_SETTINGS.primes)
    expect(v.settings.scale).toBeNull()
  })

  it('rejects bad edo, scale out of range, bad weights', () => {
    expect(validateSettings({ edo: 3 }).ok).toBe(false)
    expect(validateSettings({ edo: 53, scale: [0, 60] }).ok).toBe(false)
    expect(validateSettings({ weights: { jumpWeight: -1 } }).ok).toBe(false)
    expect(validateSettings({ rhythmSettings: { mode: 'weird' } }).ok).toBe(false)
    expect(validateSettings('nope').ok).toBe(false)
    expect(validateSettings(null).ok).toBe(false)
  })

  it('keeps valid partial weights and rhythm overrides', () => {
    const v = validateSettings({
      weights: { jumpWeight: 8 },
      rhythmSettings: { mode: 'full', measureSec: 2.5 },
    })
    expect(v.ok).toBe(true)
    expect(v.settings.weights.jumpWeight).toBe(8)
    expect(v.settings.weights.thematicWeight).toBe(0.5)
    expect(v.settings.rhythmSettings.mode).toBe('full')
    expect(v.settings.rhythmSettings.measureSec).toBe(2.5)
  })

  it('drops a malformed comma instead of failing', () => {
    const v = validateSettings({ selectedComma: { nope: true } })
    expect(v.ok).toBe(true)
    expect(v.settings.selectedComma).toBeNull()
  })
})

describe('JSON round-trip', () => {
  it('serialise → parse returns the same settings', () => {
    const settings = validateSettings(BUILTIN_PRESETS[0].settings).settings
    const text = serializeSettingsFile({ name: 'Happy', settings, waveform: 'f2' })
    const back = parseSettingsFile(text)
    expect(back.ok).toBe(true)
    expect(back.name).toBe('Happy')
    expect(back.waveform).toBe('f2')
    expect(back.settings).toEqual(settings)
  })

  it('accepts a bare settings object without the wrapper', () => {
    const back = parseSettingsFile(JSON.stringify({ edo: 19, scale: [0, 3, 6] }))
    expect(back.ok).toBe(true)
    expect(back.settings.edo).toBe(19)
  })

  it('rejects non-JSON and invalid settings', () => {
    expect(parseSettingsFile('{oops').ok).toBe(false)
    expect(parseSettingsFile(JSON.stringify({ edo: 2 })).ok).toBe(false)
    expect(parseSettingsFile('[]').ok).toBe(false)
  })
})

describe('settingsFromState', () => {
  it('extracts only the settings keys', () => {
    const state = { edo: 31, primes: [2, 3], snapshots: [1, 2], currentStep: 4, scale: [0, 5] }
    const s = settingsFromState(state)
    expect(s.edo).toBe(31)
    expect(s.scale).toEqual([0, 5])
    expect(s.snapshots).toBeUndefined()
    expect(s.currentStep).toBeUndefined()
  })
})

describe('user presets storage', () => {
  it('save → load → delete round-trips with a fake storage', () => {
    const st = fakeStorage()
    expect(loadUserPresets(st)).toEqual([])
    const preset = {
      id: makeUserPresetId('My Thing'), name: 'My Thing', user: true,
      blurb: '', facts: [], waveform: 'f2', snapshotHint: '',
      settings: validateSettings({ edo: 19 }).settings,
    }
    saveUserPreset(preset, st)
    const loaded = loadUserPresets(st)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('My Thing')
    // saving the same id replaces instead of duplicating
    saveUserPreset({ ...preset, name: 'Renamed' }, st)
    expect(loadUserPresets(st)).toHaveLength(1)
    expect(loadUserPresets(st)[0].name).toBe('Renamed')
    deleteUserPreset(preset.id, st)
    expect(loadUserPresets(st)).toEqual([])
  })

  it('corrupt stored JSON loads as empty', () => {
    const st = fakeStorage()
    st.setItem('microtonal2.userPresets.v1', '{broken')
    expect(loadUserPresets(st)).toEqual([])
  })

  it('makeUserPresetId slugifies', () => {
    expect(makeUserPresetId('My Cool Preset!')).toMatch(/^user-my-cool-preset-[a-z0-9]+$/)
  })
})
