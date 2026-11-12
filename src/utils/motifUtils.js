/**
 * Motif seeding: plant a short, recognisable phrase into the score array
 * before (or during) annealing, so the piece grows around a tune instead
 * of starting from pure noise.
 *
 * Motifs are stored as SCALE DEGREES (0 = tonic of the current scale),
 * not as absolute pitches. That means a motif follows whatever scale
 * the user built: the contour and rhythm of the original are preserved,
 * the exact intervals follow the current scale. A motif that leans on
 * chromatic notes (e.g. the Jaws semitone) will sound like its nearest
 * in-scale neighbour instead — the note field on each preset says so
 * where it matters.
 */

export const MAX_MOTIF_NOTES = 16

/** Default preset when the feature is turned on. */
export const DEFAULT_PRESET_ID = 'beethoven5'

export const PRESET_MOTIFS = [
  {
    id: 'beethoven5', name: "Beethoven's 5th", song: 'Symphony No. 5', genre: 'Classical',
    degrees: [4, 4, 4, 2],
    note: 'Short-short-short-long: G G G E♭. The most famous four notes in music.',
  },
  {
    id: 'ode-to-joy', name: 'Ode to Joy', song: 'Beethoven, Symphony No. 9', genre: 'Classical',
    degrees: [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1],
    note: 'The full opening phrase — a rising, stepwise tune.',
  },
  {
    id: 'twinkle', name: 'Twinkle, Twinkle, Little Star', song: 'Traditional', genre: "Children's",
    degrees: [0, 0, 4, 4, 5, 5, 4],
    note: 'The opening line: up to the fifth, step up once, back down.',
  },
  {
    id: 'happy-birthday', name: 'Happy Birthday', song: 'Traditional', genre: 'Pop',
    degrees: [4, 4, 5, 4, 0, 6],
    note: '"Happy birthday to you" — starts on the fifth, lands on the tonic.',
  },
  {
    id: 'jaws', name: 'Jaws theme', song: 'John Williams, Jaws', genre: 'Film',
    degrees: [0, 1, 0, 1, 0, 1, 0, 1],
    note: 'Two alternating notes. The original is a semitone apart; in most scales the step is a whole tone, so you keep the pulsing rhythm and contour, not the exact menace.',
  },
  {
    id: 'star-wars', name: 'Star Wars main theme', song: 'John Williams, Star Wars', genre: 'Film',
    degrees: [4, 4, 4, 0],
    note: 'The opening fanfare: three repeats, then a leap down to the tonic.',
  },
  {
    id: 'greensleeves', name: 'Greensleeves', song: 'Traditional', genre: 'Folk',
    degrees: [0, 2, 3, 4, 5, 4, 3, 1],
    note: 'The opening phrase in the minor — a slow climb and fall.',
  },
  {
    id: 'seven-nation-army', name: 'Seven Nation Army', song: 'The White Stripes', genre: 'Rock',
    degrees: [0, 0, 2, 0, 6, 5, 4],
    note: 'The riff: tonic, tonic, up a third, back, then a walk down.',
  },
]

export function getPresetMotif(id) {
  return PRESET_MOTIFS.find(m => m.id === id) ?? null
}

/**
 * Resolve the motif state kept in App into the degree list the worker
 * needs, or null when seeding is off / there is nothing to plant.
 * motif = { enabled, source: 'preset' | 'custom', presetId, customDegrees }
 */
export function resolveMotif(motif) {
  if (!motif?.enabled) return null
  if (motif.source === 'custom') {
    return (motif.customDegrees ?? []).length > 0 ? [...motif.customDegrees] : null
  }
  const preset = getPresetMotif(motif.presetId ?? DEFAULT_PRESET_ID)
  return preset ? [...preset.degrees] : null
}

/** Map degrees into 0..N-1 (wraps, so a 7-degree motif works on a 5-note scale). */
export function normalizeDegrees(degrees, N) {
  if (!degrees || N <= 0) return []
  return degrees.map(d => ((Math.round(d) % N) + N) % N)
}

/**
 * Plant a motif into a flat score array.
 * shape is [voices, d1, d2, ...]; within a voice, playback runs along
 * the flattened slice in order. Each voice gets the motif transposed by
 * 2 scale degrees per voice (harmonising in thirds), planted at the
 * start of its sequence and once more halfway through when it fits, so
 * the thematic term has a second copy to match against.
 *
 * Planted positions are also added to `pinned` (a Set, when given).
 * Annealing must never resample a pinned position: without pinning, a
 * planted motif is forgotten within ~20k iterations (measured: only
 * ~17% of planted notes survive to T20, vs ~13% by chance, and no
 * 5-note fragment survives at all). Pinning is what makes the tune
 * actually stay in the piece — the rest of the score anneals around it.
 * @returns {number} positions written
 */
export function seedScoreWithMotif(scoreArray, shape, motifDegrees, N, pinned = null) {
  const motif = normalizeDegrees(motifDegrees, N)
  if (motif.length === 0 || !shape || shape.length === 0 || N <= 0) return 0
  const total = shape.reduce((a, b) => a * b, 1)
  const voiceCount = shape[0]
  const voiceLen = Math.floor(total / voiceCount)
  if (voiceLen <= 0) return 0

  let written = 0
  const plant = (start, degrees) => {
    for (let i = 0; i < degrees.length && start + i < total; i++) {
      scoreArray[start + i] = degrees[i]
      pinned?.add(start + i)
      written++
    }
  }
  for (let v = 0; v < voiceCount; v++) {
    const base = v * voiceLen
    const shift = (v * 2) % N
    const degrees = motif.map(d => (d + shift) % N)
    plant(base, degrees)
    const half = base + Math.floor(voiceLen / 2)
    if (half + degrees.length <= base + voiceLen && half > base + degrees.length) {
      plant(half, degrees)
    }
  }
  return written
}

// ─── Tone preview (for the "play your own" UI) ───────────────────────────────

/** Frequency of a scale degree, in the octave above rootHz. */
export function motifDegreeToHz(degree, scale, edo, rootHz = 131) {
  const N = scale.length
  if (N === 0) return rootHz
  const d = ((Math.round(degree) % N) + N) % N
  return rootHz * Math.pow(2, scale[d] / edo)
}

let previewCtx = null

/** Play one short sine tone. No-op outside a browser (tests, Node). */
export function playTone(freqHz, durationSec = 0.35) {
  if (typeof window === 'undefined') return
  const AC = window.AudioContext ?? window.webkitAudioContext
  if (!AC) return
  previewCtx ??= new AC()
  if (previewCtx.state === 'suspended') void previewCtx.resume()
  const t0 = previewCtx.currentTime
  const osc = previewCtx.createOscillator()
  const gain = previewCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freqHz
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec)
  osc.connect(gain).connect(previewCtx.destination)
  osc.start(t0)
  osc.stop(t0 + durationSec + 0.05)
}

/** Play a whole motif, one note after another. */
export function playMotif(degrees, scale, edo, noteSec = 0.35) {
  if (typeof window === 'undefined') return
  degrees.forEach((d, i) => {
    window.setTimeout(() => playTone(motifDegreeToHz(d, scale, edo), noteSec), i * noteSec * 1000)
  })
}
