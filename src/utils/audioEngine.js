/**
 * Jim's CSound GEN10 f-table harmonic amplitudes, read directly from the
 * 270-EDO reference score. Index 0 = fundamental, 1 = 2nd harmonic, etc.
 */
export const F_TABLES = {
  f1: [1],
  f2: [1, 0.5, 0.3, 0.25, 0.2, 0.167, 0.14, 0.125, 0.0111, 0.08, 0.08, 0.008, 0.008, 0.008, 0.007, 0.006],
  f3: [1, 0.3, 0.5, 0.25, 0.2, 0.167, 0.14, 0.05, 0.05, 0.08, 0.05, 0.008, 0.005, 0.008, 0.005, 0.008],
  f4: [1, 0.3, 0.4, 0.4, 0.1, 0.1, 0.1, 0.1, 0.05, 0.01, 0.01, 0.001, 0.001, 0.001, 0.001, 0.001],
  f5: [1, 0.5, 0.3, 0.1, 0.2, 0.1, 0.1, 0.01, 0.02, 0.01, 0.02, 0.001, 0.002, 0.001, 0.002, 0.001],
  f6: [1, 0.3, 0.3, 0.3, 0.3, 0.03, 0.03, 0.1, 0.03, 0.03, 0.01, 0.003, 0.003, 0.001, 0.003, 0.003],
  f7: [1, 0.6, 0.2, 0.1, 0.3, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.007, 0.008, 0.009, 0.001, 0.001],
}

/**
 * Extract GEN10 f-table harmonic arrays from a CSound score string.
 * Returns an object keyed by "f1", "f2", etc.
 * @param {string} csoundText
 * @returns {Record<string, number[]>}
 */
export function parseFTables(csoundText) {
  const tables = {}
  for (const line of csoundText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('f')) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 5) continue
    const fNum = parseInt(parts[0].slice(1), 10)
    if (isNaN(fNum)) continue
    const genRoutine = parseInt(parts[3], 10)
    if (genRoutine !== 10) continue
    const harmonics = parts.slice(4).map(Number).filter(n => !isNaN(n))
    if (harmonics.length > 0) tables[`f${fNum}`] = harmonics
  }
  return tables
}

/**
 * Zip per-voice rhythm timing with the score array to produce note events.
 *
 * scoreArray[v * numScoreSlots + k] is the scale index for voice v, event k.
 * If rhythmPerVoice[v] has more events than numScoreSlots, pitch indices wrap.
 *
 * @param {Int16Array}  scoreArray      Flat array of scale-degree indices
 * @param {number[]}    scoreShape      e.g. [3, 6, 6, 6] — first dim is numVoices
 * @param {number[]}    scale           EDO step for each scale degree
 * @param {number}      edo             EDO value
 * @param {object[][]}  rhythmPerVoice  rhythmPerVoice[v] = [{startSec, durationSec, isRest}, ...]
 * @param {number}      [baseHz=72]     Reference frequency in Hz
 * @param {number[]}    [gainPerVoice]  Per-voice gain (default 0.4)
 * @returns {{ startSec, durationSec, freqHz, voice, gainValue, isRest }[]}
 */
export function buildNoteEvents(
  scoreArray, scoreShape, scale, edo,
  rhythmPerVoice, baseHz = 72, gainPerVoice = null,
) {
  const numVoices    = scoreShape[0]
  const numScoreSlots = scoreShape.slice(1).reduce((a, b) => a * b, 1)
  const N            = scale.length
  const noteEvents   = []

  for (let v = 0; v < numVoices; v++) {
    const rhythm      = rhythmPerVoice[v] ?? []
    const baseOffset  = v * numScoreSlots
    const voiceGain   = gainPerVoice?.[v] ?? 0.4

    for (let k = 0; k < rhythm.length; k++) {
      const { startSec, durationSec, isRest } = rhythm[k]
      const pitchIdx = scoreArray[baseOffset + (k % numScoreSlots)]
      const edoStep  = scale[pitchIdx % N]
      const freqHz   = baseHz * Math.pow(2, edoStep / edo)
      noteEvents.push({ startSec, durationSec, freqHz, voice: v, gainValue: voiceGain, isRest })
    }
  }

  return noteEvents
}

const ATTACK_SEC  = 0.005
const RELEASE_SEC = 0.020

/**
 * Web Audio API manager.
 *
 * AudioContext is created lazily on the first call to start(), satisfying
 * the browser requirement that AudioContext only be created after a user gesture.
 *
 * Usage:
 *   const engine = new AudioEngine()
 *   engine.start(noteEvents, { waveform: 'sine', masterGain: 0.5 })
 *   engine.stop()
 *   engine.destroy()   // on component unmount
 */
export class AudioEngine {
  constructor() {
    this._ctx           = null
    this._masterGain    = null
    this._voiceGains    = []
    this._sources       = []
    this._startTime     = null  // ctx.currentTime at which score position 0 plays
    this._totalDuration = 0
  }

  _ensureContext() {
    if (!this._ctx) {
      this._ctx        = new AudioContext()
      this._masterGain = this._ctx.createGain()
      this._masterGain.connect(this._ctx.destination)
    }
    if (this._ctx.state === 'suspended') this._ctx.resume()
    return this._ctx
  }

  _periodicWave(harmonics) {
    const size = harmonics.length + 1
    const real = new Float32Array(size)  // DC = 0, cosine terms = 0
    const imag = new Float32Array(size)  // sine terms carry the harmonic amplitudes
    for (let i = 0; i < harmonics.length; i++) imag[i + 1] = harmonics[i]
    return this._ctx.createPeriodicWave(real, imag)
  }

  /**
   * Schedule all note events for playback starting `startOffset` seconds from now.
   * Stops any previous playback first.
   *
   * @param {object[]} noteEvents     Output of buildNoteEvents or importCSound
   * @param {object}   [options]
   * @param {string}   [options.waveform='sine']    'sine'|'triangle'|'sawtooth'|'square'
   * @param {number[]} [options.harmonics]          GEN10 amplitudes — overrides waveform
   * @param {number[]} [options.voiceGains=[]]      Per-voice gain multipliers (0–1)
   * @param {number}   [options.masterGain=0.5]     Master output gain
   * @param {number}   [options.startOffset=0]      Seconds from now to begin
   * @param {number}   [options.seekFrom=0]         Score position (seconds) to seek to
   */
  start(noteEvents, options = {}) {
    const ctx = this._ensureContext()
    this.stop()

    const {
      waveform    = 'sine',
      harmonics   = null,
      voiceGains  = [],
      masterGain  = 0.5,
      startOffset = 0,
      seekFrom    = 0,
    } = options

    this._masterGain.gain.value = masterGain

    this._totalDuration = noteEvents.reduce((m, e) => Math.max(m, e.startSec + e.durationSec), 0)

    const numVoices = noteEvents.reduce((m, e) => Math.max(m, e.voice + 1), 0)
    this._voiceGains = Array.from({ length: numVoices }, (_, v) => {
      const g = ctx.createGain()
      g.gain.value = voiceGains[v] ?? 1.0
      g.connect(this._masterGain)
      return g
    })

    const periodicWave = harmonics ? this._periodicWave(harmonics) : null
    // _startTime is the ctx clock value at which score position 0 would start
    this._startTime = ctx.currentTime + startOffset - seekFrom
    const now = this._startTime

    for (const e of noteEvents) {
      if (e.isRest || e.durationSec <= 0 || e.freqHz <= 0) continue
      // skip notes that ended before the seek position
      if (e.startSec + e.durationSec <= seekFrom) continue

      const t0 = now + e.startSec
      const t1 = t0 + e.durationSec
      const tA = Math.min(t0 + ATTACK_SEC, t1)
      const tR = Math.max(t1 - RELEASE_SEC, tA)

      const osc = ctx.createOscillator()
      const env = ctx.createGain()

      if (periodicWave) {
        osc.setPeriodicWave(periodicWave)
      } else {
        osc.type = waveform
      }
      osc.frequency.value = e.freqHz

      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(e.gainValue, tA)
      env.gain.setValueAtTime(e.gainValue, tR)
      env.gain.linearRampToValueAtTime(0, t1)

      osc.connect(env)
      env.connect(this._voiceGains[e.voice])
      osc.start(t0)
      osc.stop(t1)

      this._sources.push(osc)
    }
  }

  stop() {
    for (const s of this._sources) {
      try { s.stop(0) } catch (_) {}
    }
    this._sources    = []
    for (const g of this._voiceGains) g.disconnect()
    this._voiceGains = []
    this._startTime  = null
  }

  setMasterGain(value) {
    if (this._masterGain) this._masterGain.gain.value = value
  }

  setVoiceGain(voice, value) {
    if (this._voiceGains[voice]) this._voiceGains[voice].gain.value = value
  }

  // Current score position in seconds (distance from _startTime)
  get playbackPosition() {
    if (this._startTime === null || !this._ctx) return 0
    return Math.max(0, this._ctx.currentTime - this._startTime)
  }

  get totalDuration() {
    return this._totalDuration
  }

  get currentTime() {
    return this._ctx?.currentTime ?? 0
  }

  get isRunning() {
    return this._sources.length > 0
  }

  destroy() {
    this.stop()
    this._ctx?.close()
    this._ctx        = null
    this._masterGain = null
  }
}
