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
 * voiceSettings[v].centerHz shifts the voice into the appropriate octave:
 * octave = floor(log2(centerHz / baseHz)), applied as a frequency multiplier.
 *
 * @param {Int16Array}  scoreArray      Flat array of scale-degree indices
 * @param {number[]}    scoreShape      e.g. [3, 6, 6, 6] — first dim is numVoices
 * @param {number[]}    scale           EDO step for each scale degree
 * @param {number}      edo             EDO value
 * @param {object[][]}  rhythmPerVoice  rhythmPerVoice[v] = [{startSec, durationSec, isRest}, ...]
 * @param {number}      [baseHz=72]     Reference frequency in Hz
 * @param {number[]}    [gainPerVoice]  Per-voice gain (default 0.4)
 * @param {object[]}    [voiceSettings] voiceSettings[v] = { centerHz } for octave placement
 * @returns {{ startSec, durationSec, freqHz, voice, gainValue, isRest }[]}
 */
export function buildNoteEvents(
  scoreArray, scoreShape, scale, edo,
  rhythmPerVoice, baseHz = 72, gainPerVoice = null, voiceSettings = null,
) {
  const numVoices    = scoreShape[0]
  const numScoreSlots = scoreShape.slice(1).reduce((a, b) => a * b, 1)
  const N            = scale.length
  const noteEvents   = []

  for (let v = 0; v < numVoices; v++) {
    const rhythm      = rhythmPerVoice[v] ?? []
    const baseOffset  = v * numScoreSlots
    const voiceGain   = gainPerVoice?.[v] ?? 0.4
    const centerHz    = voiceSettings?.[v]?.centerHz
    const octave      = centerHz != null ? Math.floor(Math.log2(centerHz / baseHz)) : 0

    for (let k = 0; k < rhythm.length; k++) {
      const { startSec, durationSec, isRest } = rhythm[k]
      const pitchIdx = scoreArray[baseOffset + (k % numScoreSlots)]
      const edoStep  = scale[pitchIdx % N]
      const freqHz   = baseHz * Math.pow(2, edoStep / edo + octave)
      noteEvents.push({ startSec, durationSec, freqHz, voice: v, gainValue: voiceGain, isRest })
    }
  }

  return noteEvents
}

const ATTACK_SEC        = 0.005
const RELEASE_SEC       = 0.020
const SCHEDULE_AHEAD_SEC = 10   // rolling lookahead window in seconds

/**
 * Encode a Float32Array (mono or interleaved stereo) as a 16-bit PCM WAV blob.
 * @param {Float32Array} samples  Interleaved PCM in [-1, 1]
 * @param {number}       sampleRate
 * @param {number}       numChannels  1 or 2
 * @returns {Blob}
 */
export function encodeWav(samples, sampleRate, numChannels = 1) {
  const numSamples = samples.length
  const dataBytes  = numSamples * 2  // 16-bit = 2 bytes per sample
  const buffer     = new ArrayBuffer(44 + dataBytes)
  const view       = new DataView(buffer)

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  function clamp16(x) { return Math.max(-32768, Math.min(32767, Math.round(x * 32767))) }

  writeStr(0,  'RIFF')
  view.setUint32(4,  36 + dataBytes, true)
  writeStr(8,  'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)            // PCM chunk size
  view.setUint16(20, 1,  true)            // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)  // byte rate
  view.setUint16(32, numChannels * 2, true)               // block align
  view.setUint16(34, 16, true)            // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let i = 0; i < numSamples; i++)
    view.setInt16(44 + i * 2, clamp16(samples[i]), true)

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Render note events to a WAV Blob using OfflineAudioContext (non-realtime).
 * Mirrors the AudioEngine playback graph exactly.
 *
 * @param {object[]} noteEvents   Output of buildNoteEvents
 * @param {object}   [options]    Same shape as AudioEngine.start() options
 * @param {number}   [sampleRate=44100]
 * @returns {Promise<Blob>}
 */
export async function renderToWav(noteEvents, options = {}, sampleRate = 44100) {
  const {
    waveform   = 'sine',
    harmonics  = null,
    voiceGains = [],
    masterGain = 0.5,
  } = options

  const totalDuration = noteEvents.reduce((m, e) => Math.max(m, e.startSec + e.durationSec), 0)
  if (totalDuration <= 0) throw new Error('No note events to render')

  // Small tail so the last note's release doesn't get clipped
  const lengthSamples  = Math.ceil((totalDuration + 0.1) * sampleRate)
  const numVoices      = noteEvents.reduce((m, e) => Math.max(m, e.voice + 1), 0)

  const ctx            = new OfflineAudioContext(1, lengthSamples, sampleRate)
  const master         = ctx.createGain()
  master.gain.value    = masterGain
  master.connect(ctx.destination)

  const vGains = Array.from({ length: numVoices }, (_, v) => {
    const g = ctx.createGain()
    g.gain.value = voiceGains[v] ?? 1.0
    g.connect(master)
    return g
  })

  let periodicWave = null
  if (harmonics) {
    const size = harmonics.length + 1
    const real = new Float32Array(size)
    const imag = new Float32Array(size)
    for (let i = 0; i < harmonics.length; i++) imag[i + 1] = harmonics[i]
    periodicWave = ctx.createPeriodicWave(real, imag)
  }

  for (const e of noteEvents) {
    if (e.isRest || !(e.freqHz > 0) || e.durationSec <= 0) continue
    const t0 = e.startSec
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
    env.connect(vGains[e.voice])
    osc.start(t0)
    osc.stop(t1)
  }

  const rendered = await ctx.startRendering()
  return encodeWav(rendered.getChannelData(0), sampleRate, 1)
}

/**
 * Web Audio API manager.
 *
 * AudioContext is created lazily on the first call to start(), satisfying
 * the browser requirement that AudioContext only be created after a user gesture.
 * Uses a rolling lookahead scheduler: only schedules the next SCHEDULE_AHEAD_SEC
 * worth of notes at a time. Call scheduleAhead() from a rAF loop to keep the
 * window filled as playback advances.
 *
 * Usage:
 *   const engine = new AudioEngine()
 *   engine.start(noteEvents, { waveform: 'sine', masterGain: 0.5 })
 *   engine.scheduleAhead()   // call each rAF tick
 *   engine.stop()
 *   engine.destroy()   // on component unmount
 */
export class AudioEngine {
  constructor() {
    this._ctx             = null
    this._masterGain      = null
    this._voiceGains      = []
    this._sources         = []
    this._startTime       = null  // ctx.currentTime at which score position 0 plays
    this._totalDuration   = 0
    // Lookahead scheduler state
    this._allEvents       = []    // sorted by startSec, set by start()
    this._schedIdx        = 0    // index of next event not yet scheduled
    this._cachedWaveform  = 'sine'
    this._cachedWave      = null  // PeriodicWave or null
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
   * Begin playback. Schedules the first SCHEDULE_AHEAD_SEC seconds immediately;
   * call scheduleAhead() each rAF tick to keep the window filled.
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

    this._cachedWaveform = waveform
    this._cachedWave     = harmonics ? this._periodicWave(harmonics) : null

    // Sort events by start time and skip past the seek position
    this._allEvents = [...noteEvents].sort((a, b) => a.startSec - b.startSec)
    this._schedIdx  = 0
    while (
      this._schedIdx < this._allEvents.length &&
      this._allEvents[this._schedIdx].startSec + this._allEvents[this._schedIdx].durationSec <= seekFrom
    ) {
      this._schedIdx++
    }

    // _startTime: ctx clock value at which score position 0 would play
    this._startTime = ctx.currentTime + startOffset - seekFrom

    this.scheduleAhead(SCHEDULE_AHEAD_SEC)
  }

  /**
   * Schedule events whose startSec falls within the next lookaheadSec seconds.
   * Call this each rAF tick to keep the rolling window filled.
   */
  scheduleAhead(lookaheadSec = SCHEDULE_AHEAD_SEC) {
    if (!this._ctx || this._startTime === null) return
    const ctx          = this._ctx
    const scoreHorizon = ctx.currentTime + lookaheadSec - this._startTime

    while (this._schedIdx < this._allEvents.length) {
      const e = this._allEvents[this._schedIdx]
      if (e.startSec > scoreHorizon) break
      this._schedIdx++

      if (e.isRest || !(e.freqHz > 0) || e.durationSec <= 0) continue

      const t0 = this._startTime + e.startSec
      const t1 = t0 + e.durationSec
      if (t1 <= ctx.currentTime) continue  // note already ended

      const tA = Math.min(t0 + ATTACK_SEC, t1)
      const tR = Math.max(t1 - RELEASE_SEC, tA)

      const osc = ctx.createOscillator()
      const env = ctx.createGain()

      if (this._cachedWave) {
        osc.setPeriodicWave(this._cachedWave)
      } else {
        osc.type = this._cachedWaveform
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

      osc.onended = () => {
        const idx = this._sources.indexOf(osc)
        if (idx >= 0) this._sources.splice(idx, 1)
      }
      this._sources.push(osc)
    }
  }

  stop() {
    // Null callbacks before stopping to prevent stale onended splices into new _sources
    const sources = this._sources
    this._sources = []
    for (const s of sources) {
      s.onended = null
      try { s.stop(0) } catch (_) {}
    }
    for (const g of this._voiceGains) g.disconnect()
    this._voiceGains  = []
    this._startTime   = null
    this._totalDuration = 0
    this._allEvents   = []
    this._schedIdx    = 0
  }

  // Call this inside a user-gesture handler to create/resume the AudioContext before
  // any programmatic play requests that arrive outside a gesture (e.g. from PROGRESS callbacks).
  prepare() {
    this._ensureContext()
  }

  setMasterGain(value) {
    if (this._masterGain) this._masterGain.gain.value = value
  }

  setVoiceGain(voice, value) {
    if (this._voiceGains[voice]) this._voiceGains[voice].gain.value = value
  }

  // Diagnostic: 440 Hz sine at gain 1.0 directly into destination, bypassing all gain nodes.
  // If this is quiet, the issue is at the system/browser level, not the gain chain.
  testTone(durationSec = 2) {
    const ctx  = this._ensureContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 440
    gain.gain.value = 1.0
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t0 = ctx.currentTime + 0.01
    osc.start(t0)
    osc.stop(t0 + durationSec)
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
