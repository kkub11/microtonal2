// Presets: the new front door of the app.
//
// A preset is a whole recipe — tuning, scale, cost settings, weights,
// rhythm, motif — in one named bundle, written in plain language. Pick
// one and you are making music; the six-step flow still exists under
// "Advanced" for anyone who wants to build from scratch.
//
// Built-in presets are the recipes already measured in this repo
// (G1/G2/E1/E3/H4 renders, 2026-11-12): nothing here is a guess about
// what sounds good — each one is a render Kanon has actually heard.
// User presets are saved in localStorage; a settings file is the same
// JSON, so export/import round-trips through this module.

// ─── Settings shape ────────────────────────────────────────────────────────
// The settings object is the slice of App state a preset owns. Keys:
//   edo, primes, xInterval, yInterval, selectedComma, scale,
//   costParams, voiceCount, voiceSettings, cubeDims, weights,
//   motif, twoPhase, rhythmSettings
// A preset record adds presentation on top:
//   { id, name, blurb, facts, settings, waveform, snapshotHint,
//     user?: true }

export const SETTINGS_KEYS = [
  'edo', 'primes', 'xInterval', 'yInterval', 'selectedComma', 'scale',
  'costParams', 'voiceCount', 'voiceSettings', 'cubeDims', 'weights',
  'motif', 'twoPhase', 'rhythmSettings',
]

// Defaults used to fill in anything a settings file or preset omits.
// These match App.jsx initialState (2026-11-12, branch musicality-fixes).
export const DEFAULT_SETTINGS = {
  edo: 53,
  primes: [2, 3, 5],
  xInterval: { ratio: [3, 2] },
  yInterval: { ratio: [5, 4] },
  selectedComma: null,
  scale: null,
  costParams: { power: 1.0, maxPQ: 100, proximityK: 0.1 },
  voiceCount: 3,
  voiceSettings: [{ centerHz: 131 }, { centerHz: 196 }, { centerHz: 294 }],
  cubeDims: [6, 6, 6],
  weights: { rangeWeight: 1.0, jumpWeight: 5.0, thematicWeight: 0.5, thematicTransposed: false },
  motif: { enabled: false, source: 'preset', presetId: 'beethoven5', customDegrees: [] },
  twoPhase: { enabled: false },
  rhythmSettings: {
    mode: 'simple',
    measureSec: 5.0,
    divisor: 4,
    allowedDivisors: [2, 3],
    minNoteSec: 0.15,
    restProb: 0.1,
    joinProb: 0.3,
    capLongNotes: true,
    measureJitter: 0.1,
    independentVoices: true,
  },
}

const MOS7_53 = [0, 9, 18, 27, 31, 40, 49]
const PENT_53 = [0, 9, 18, 31, 40]

function baseSettings(overrides) {
  return {
    edo: 53,
    primes: [2, 3, 5],
    xInterval: { ratio: [3, 2] },
    yInterval: { ratio: [5, 4] },
    selectedComma: null,
    costParams: { power: 1.0, maxPQ: 100, proximityK: 0.1 },
    cubeDims: [4, 4, 4], // 64 measures — about a 3-minute piece at 3 s/measure
    twoPhase: { enabled: false },
    ...overrides,
  }
}

function fullRhythm(overrides) {
  return {
    mode: 'full',
    measureSec: 3.0,
    divisor: 4,
    allowedDivisors: [2, 3, 4],
    minNoteSec: 0.5,
    restProb: 0.2,
    joinProb: 0.5,
    capLongNotes: true,
    measureJitter: 0.15,
    independentVoices: true,
    ...overrides,
  }
}

const BASE_WEIGHTS = {
  rangeWeight: 1.0, jumpWeight: 5.0, thematicWeight: 0.5,
  thematicTransposed: false, repeatCost: 2.0,
}

export const BUILTIN_PRESETS = [
  {
    id: 'happy',
    name: 'Happy',
    blurb: 'Bright and upbeat. A major-like scale, three voices, a medium pace — the closest thing to a happy tune this machine makes.',
    facts: ['3 voices', 'Bright 7-note scale', 'Medium pace', 'About 3 minutes'],
    waveform: 'f2',
    snapshotHint: 'Cool slowly to about T20, then snapshot — that is where the piece settles.',
    settings: baseSettings({
      scale: MOS7_53,
      voiceCount: 3,
      voiceSettings: [{ centerHz: 131 }, { centerHz: 196 }, { centerHz: 294 }],
      weights: { ...BASE_WEIGHTS },
      motif: { enabled: false, source: 'preset', presetId: 'beethoven5', customDegrees: [] },
      rhythmSettings: fullRhythm({}),
    }),
  },
  {
    id: 'calm',
    name: 'Calm',
    blurb: 'Slow and spacious. Two voices, a five-note scale, long pauses — calming, if that is the point.',
    facts: ['2 voices', '5-note scale', 'Slow', 'About 4 minutes'],
    waveform: 'f7',
    snapshotHint: 'Cool slowly to about T25, then snapshot.',
    settings: baseSettings({
      scale: PENT_53,
      voiceCount: 2,
      voiceSettings: [{ centerHz: 131 }, { centerHz: 196 }],
      weights: { ...BASE_WEIGHTS },
      motif: { enabled: false, source: 'preset', presetId: 'beethoven5', customDegrees: [] },
      rhythmSettings: fullRhythm({
        measureSec: 4.0, allowedDivisors: [2, 3], minNoteSec: 0.6,
        restProb: 0.25, joinProb: 0.55, measureJitter: 0.2,
      }),
    }),
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    blurb: 'A familiar tune the piece grows around. Ode to Joy is planted in the score and kept there, so the music keeps coming back to it — sometimes shifted.',
    facts: ['3 voices', 'Ode to Joy motif', 'Phrases come back shifted'],
    waveform: 'f2',
    snapshotHint: 'Cool slowly to about T20, then snapshot. Listen for Ode to Joy coming back, shifted.',
    settings: baseSettings({
      scale: MOS7_53,
      voiceCount: 3,
      voiceSettings: [{ centerHz: 131 }, { centerHz: 196 }, { centerHz: 294 }],
      weights: { ...BASE_WEIGHTS, thematicWeight: 2.0, thematicTransposed: true },
      motif: { enabled: true, source: 'preset', presetId: 'ode-to-joy', customDegrees: [] },
      rhythmSettings: fullRhythm({}),
    }),
  },
  {
    id: 'chorale',
    name: 'Chorale',
    blurb: 'Voices moving together, hymn-like. All three voices share one rhythm, in close harmony.',
    facts: ['3 voices', 'Shared rhythm', 'Close harmony'],
    waveform: 'f2',
    snapshotHint: 'Cool slowly to about T20, then snapshot.',
    settings: baseSettings({
      scale: MOS7_53,
      voiceCount: 3,
      voiceSettings: [{ centerHz: 131 }, { centerHz: 165 }, { centerHz: 196 }],
      weights: { ...BASE_WEIGHTS },
      motif: { enabled: false, source: 'preset', presetId: 'beethoven5', customDegrees: [] },
      rhythmSettings: fullRhythm({
        allowedDivisors: [2, 3], restProb: 0.15, joinProb: 0.4,
        measureJitter: 0.1, independentVoices: false,
      }),
    }),
  },
  {
    id: 'solo',
    name: 'Solo',
    blurb: 'One voice, bare and clear. Nothing to hide behind — good for hearing what a single line does.',
    facts: ['1 voice', 'Bare and clear'],
    waveform: 'f2',
    snapshotHint: 'Cool slowly to about T20, then snapshot.',
    settings: baseSettings({
      scale: MOS7_53,
      voiceCount: 1,
      voiceSettings: [{ centerHz: 196 }],
      weights: { ...BASE_WEIGHTS },
      motif: { enabled: false, source: 'preset', presetId: 'beethoven5', customDegrees: [] },
      rhythmSettings: fullRhythm({ allowedDivisors: [2, 3] }),
    }),
  },
]

// ─── Validation ────────────────────────────────────────────────────────────
// Lenient by design: unknown fields are dropped, missing fields are
// filled from DEFAULT_SETTINGS, and only values that would break the
// annealer are rejected. Returns { ok: true, settings } or
// { ok: false, error }.

function isInt(n) { return Number.isInteger(n) }
function isNum(n) { return typeof n === 'number' && Number.isFinite(n) }
function isIntArray(a, minLen = 1) {
  return Array.isArray(a) && a.length >= minLen && a.every(isInt)
}

export function validateSettings(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Settings must be a JSON object.' }
  }
  const s = { ...DEFAULT_SETTINGS }
  const bad = (field, why) => ({ ok: false, error: `Invalid ${field}: ${why}` })

  if (input.edo !== undefined) {
    if (!isInt(input.edo) || input.edo < 5 || input.edo > 200) return bad('edo', 'expected an integer from 5 to 200')
    s.edo = input.edo
  }
  if (input.primes !== undefined) {
    if (!isIntArray(input.primes) || input.primes.some(p => p < 2)) return bad('primes', 'expected a list of integers ≥ 2')
    s.primes = input.primes
  }
  for (const key of ['xInterval', 'yInterval']) {
    if (input[key] !== undefined) {
      const v = input[key]
      const okRatio = v && Array.isArray(v.ratio) && v.ratio.length === 2 && v.ratio.every(n => isInt(n) && n > 0)
      const okCents = v && isNum(v.cents)
      if (!okRatio && !okCents) return bad(key, 'expected { ratio: [p, q] } or { cents }')
      s[key] = v
    }
  }
  if (input.selectedComma !== undefined) {
    // A comma is an opaque record from the comma picker; keep it only
    // when it looks like one, otherwise drop it (the scale stands alone).
    const c = input.selectedComma
    s.selectedComma = (c && Array.isArray(c.monzo)) ? c : null
  }
  if (input.scale !== undefined) {
    if (input.scale !== null && (!isIntArray(input.scale) || input.scale.some(d => d < 0 || d >= s.edo))) {
      return bad('scale', 'expected a list of scale degrees within the EDO')
    }
    s.scale = input.scale
  }
  if (input.costParams !== undefined) {
    const cp = input.costParams
    if (!cp || !isNum(cp.power) || !isNum(cp.maxPQ) || !isNum(cp.proximityK)
        || cp.power <= 0 || cp.maxPQ <= 0 || cp.proximityK < 0) {
      return bad('costParams', 'expected { power > 0, maxPQ > 0, proximityK ≥ 0 }')
    }
    s.costParams = { power: cp.power, maxPQ: cp.maxPQ, proximityK: cp.proximityK }
  }
  if (input.voiceCount !== undefined) {
    if (!isInt(input.voiceCount) || input.voiceCount < 1 || input.voiceCount > 8) return bad('voiceCount', 'expected an integer from 1 to 8')
    s.voiceCount = input.voiceCount
  }
  if (input.voiceSettings !== undefined) {
    const vs = input.voiceSettings
    if (!Array.isArray(vs) || vs.length === 0 || vs.some(v => !v || !isNum(v.centerHz) || v.centerHz <= 0)) {
      return bad('voiceSettings', 'expected a non-empty list of { centerHz > 0 }')
    }
    s.voiceSettings = vs.map(v => ({ centerHz: v.centerHz }))
  }
  if (input.cubeDims !== undefined) {
    if (!isIntArray(input.cubeDims) || input.cubeDims.some(d => d < 1 || d > 12)) {
      return bad('cubeDims', 'expected a list of integers from 1 to 12')
    }
    s.cubeDims = input.cubeDims
  }
  if (input.weights !== undefined) {
    const w = input.weights
    if (!w || typeof w !== 'object') return bad('weights', 'expected an object')
    const out = { ...DEFAULT_SETTINGS.weights }
    for (const k of ['rangeWeight', 'jumpWeight', 'thematicWeight', 'repeatCost']) {
      if (w[k] !== undefined) {
        if (!isNum(w[k]) || w[k] < 0) return bad(`weights.${k}`, 'expected a number ≥ 0')
        out[k] = w[k]
      }
    }
    if (w.thematicTransposed !== undefined) out.thematicTransposed = !!w.thematicTransposed
    s.weights = out
  }
  if (input.motif !== undefined) {
    const m = input.motif
    if (!m || typeof m !== 'object' || typeof m.enabled !== 'boolean') return bad('motif', 'expected { enabled, source, presetId, customDegrees }')
    s.motif = {
      enabled: m.enabled,
      source: m.source === 'custom' ? 'custom' : 'preset',
      presetId: typeof m.presetId === 'string' ? m.presetId : 'beethoven5',
      customDegrees: Array.isArray(m.customDegrees) ? m.customDegrees.filter(isInt) : [],
    }
  }
  if (input.twoPhase !== undefined) {
    const t = input.twoPhase
    if (!t || typeof t !== 'object' || typeof t.enabled !== 'boolean') return bad('twoPhase', 'expected { enabled }')
    s.twoPhase = { enabled: t.enabled }
  }
  if (input.rhythmSettings !== undefined) {
    const r = input.rhythmSettings
    if (!r || typeof r !== 'object') return bad('rhythmSettings', 'expected an object')
    const out = { ...DEFAULT_SETTINGS.rhythmSettings }
    if (r.mode !== undefined) {
      if (r.mode !== 'simple' && r.mode !== 'full') return bad('rhythmSettings.mode', "expected 'simple' or 'full'")
      out.mode = r.mode
    }
    for (const k of ['measureSec', 'minNoteSec', 'restProb', 'joinProb', 'measureJitter']) {
      if (r[k] !== undefined) {
        if (!isNum(r[k]) || r[k] < 0) return bad(`rhythmSettings.${k}`, 'expected a number ≥ 0')
        out[k] = r[k]
      }
    }
    if (r.divisor !== undefined) {
      if (!isInt(r.divisor) || r.divisor < 1) return bad('rhythmSettings.divisor', 'expected an integer ≥ 1')
      out.divisor = r.divisor
    }
    if (r.allowedDivisors !== undefined) {
      if (!isIntArray(r.allowedDivisors) || r.allowedDivisors.some(d => d < 1)) return bad('rhythmSettings.allowedDivisors', 'expected a list of integers ≥ 1')
      out.allowedDivisors = r.allowedDivisors
    }
    for (const k of ['capLongNotes', 'independentVoices']) {
      if (r[k] !== undefined) out[k] = !!r[k]
    }
    s.rhythmSettings = out
  }
  return { ok: true, settings: s }
}

// ─── JSON round-trip ───────────────────────────────────────────────────────
// The file format is { app: 'microtonal-composer', version: 1, name?,
// settings, waveform? }. Plain JSON (unlike the human-readable text
// export in settingsExport.js, which stays as-is for reading).

export function serializeSettingsFile({ name, settings, waveform }) {
  return JSON.stringify({
    app: 'microtonal-composer',
    version: 1,
    ...(name ? { name } : {}),
    settings,
    ...(waveform ? { waveform } : {}),
  }, null, 2)
}

export function parseSettingsFile(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Expected a settings object.' }
  }
  // Accept a bare settings object too (no wrapper) — be liberal.
  const raw = parsed.settings ?? parsed
  const v = validateSettings(raw)
  if (!v.ok) return v
  return {
    ok: true,
    name: typeof parsed.name === 'string' ? parsed.name : null,
    waveform: typeof parsed.waveform === 'string' ? parsed.waveform : null,
    settings: v.settings,
  }
}

// Extract the settings slice from App state (for save-as-preset / export).
export function settingsFromState(state) {
  const out = {}
  for (const k of SETTINGS_KEYS) out[k] = state[k]
  return out
}

// ─── User presets (localStorage, with an in-memory fallback) ──────────────
// The storage adapter is injectable so tests (node env, no localStorage)
// can pass a fake. In the browser it is window.localStorage.

const USER_PRESETS_KEY = 'microtonal2.userPresets.v1'

let memoryFallback = null
export function getStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage
  } catch { /* private mode etc. — fall through */ }
  if (!memoryFallback) {
    const map = new Map()
    memoryFallback = {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, v) },
      removeItem: k => { map.delete(k) },
    }
  }
  return memoryFallback
}

export function loadUserPresets(storage = getStorage()) {
  try {
    const raw = storage.getItem(USER_PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(p => p && typeof p.id === 'string' && p.settings)
  } catch {
    return []
  }
}

export function saveUserPreset(preset, storage = getStorage()) {
  const list = loadUserPresets(storage)
  const idx = list.findIndex(p => p.id === preset.id)
  if (idx >= 0) list[idx] = preset
  else list.push(preset)
  storage.setItem(USER_PRESETS_KEY, JSON.stringify(list))
  return list
}

export function deleteUserPreset(id, storage = getStorage()) {
  const list = loadUserPresets(storage).filter(p => p.id !== id)
  storage.setItem(USER_PRESETS_KEY, JSON.stringify(list))
  return list
}

export function makeUserPresetId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preset'
  return `user-${slug}-${Date.now().toString(36)}`
}
