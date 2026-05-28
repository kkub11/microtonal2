const DEFAULT_BASE_HZ = 72
const LOUDNESS_MIN = 900
const LOUDNESS_RANGE = 500
const GAIN_MIN = 0.3
const GAIN_RANGE = 0.5

function gainToLoudness(gain) {
  return ((gain - GAIN_MIN) / GAIN_RANGE) * LOUDNESS_RANGE + LOUDNESS_MIN
}

function loudnessToGain(loudness) {
  return ((loudness - LOUDNESS_MIN) / LOUDNESS_RANGE) * GAIN_RANGE + GAIN_MIN
}

/**
 * Recover the integer EDO step from a CSound freqRatio.
 * freqRatio = 2^(edoStep / edo) → edoStep = round(edo * log2(freqRatio))
 */
export function edoStepFromFreqRatio(freqRatio, edo) {
  return Math.round(edo * Math.log2(freqRatio))
}

/**
 * Export note events to CSound-compatible .txt format.
 *
 * Voice index 0 → instrument i3, 1 → i4, etc. (matches Jim's convention).
 * Rests are omitted. freqRatio = freqHz / baseHz.
 *
 * @param {{ temperature: number, totalCost: number }} metadata
 * @param {object[]} noteEvents  { startSec, durationSec, freqHz, voice, gainValue, isRest }
 * @param {{ baseHz?: number }} [options]
 * @returns {string}
 */
export function exportCSound(metadata, noteEvents, options = {}) {
  const baseHz = options.baseHz ?? DEFAULT_BASE_HZ
  const lines = [`; temp = ${metadata.temperature}; cost = ${metadata.totalCost}`]

  for (const e of noteEvents) {
    if (e.isRest) continue
    const instrument = e.voice + 3
    const freqRatio = e.freqHz / baseHz
    const loudness = gainToLoudness(e.gainValue ?? 0.4)
    lines.push(
      `i${instrument} ${e.startSec.toFixed(8)} ${e.durationSec.toFixed(8)} ` +
      `${freqRatio.toFixed(12)} ${loudness.toFixed(2)}`
    )
  }

  return lines.join('\n')
}

/**
 * Parse a CSound .txt score file into note events.
 *
 * Voice indices are assigned 0-based in order of first instrument appearance,
 * so non-consecutive instrument numbers (e.g. i3, i5, i6) map to 0, 1, 2.
 *
 * @param {string} text
 * @param {{ baseHz?: number }} [options]
 * @returns {{ metadata: { temperature: number|null, totalCost: number|null }, noteEvents: object[] }}
 */
export function importCSound(text, options = {}) {
  const baseHz = options.baseHz ?? DEFAULT_BASE_HZ
  const lines = text.split('\n')

  let temperature = null, totalCost = null
  const metaLine = lines[0] ?? ''
  const tempMatch = metaLine.match(/temp\s*=\s*([\d.eE+\-]+)/)
  const costMatch = metaLine.match(/cost\s*=\s*([\d.eE+\-]+)/)
  if (tempMatch) temperature = parseFloat(tempMatch[1])
  if (costMatch) totalCost = parseFloat(costMatch[1])

  const voiceOrder = []
  const noteEvents = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('f')) continue
    if (!trimmed.startsWith('i')) continue

    const parts = trimmed.split(/\s+/)
    if (parts.length < 5) continue

    const instrument = parseInt(parts[0].slice(1), 10)
    const startSec = parseFloat(parts[1])
    const durationSec = parseFloat(parts[2])
    const freqRatio = parseFloat(parts[3])
    const loudness = parseFloat(parts[4])

    if ([instrument, startSec, durationSec, freqRatio, loudness].some(isNaN)) continue

    if (!voiceOrder.includes(instrument)) voiceOrder.push(instrument)
    const voice = voiceOrder.indexOf(instrument)

    noteEvents.push({
      startSec,
      durationSec,
      freqHz: freqRatio * baseHz,
      voice,
      gainValue: loudnessToGain(loudness),
      isRest: false,
    })
  }

  return { metadata: { temperature, totalCost }, noteEvents }
}
