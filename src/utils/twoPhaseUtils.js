/**
 * Two-Phase Mode (Jim's recommended workflow for preserving a seeded
 * comma traversal — see NOTES.md "The two-phase workflow").
 *
 * Phase 1: cool slowly from random init and find the transition
 * temperature — the "knuckle" where the cost curve drops sharply.
 * Phase 2: restart from the comma-traversal seed at exactly that
 * temperature, fixed (not cooling).
 */
import { commaToTonnetzPath, commaPathPositions } from './commaUtils.js'
import { getBestApprox } from './edoUtils.js'

/**
 * Turn the selected comma's Tonnetz traversal into a seed sequence of
 * scale degrees, in traversal order. Each traversal cell is a pitch
 * class (EDO step); it maps to the nearest scale degree, so the seed
 * always consists of valid scale degrees even when the traversal
 * passes through EDO steps outside the scale.
 * @returns {number[]|null} null when there is no comma / no path
 */
export function traversalToDegrees(comma, scale, edo, xInterval, yInterval) {
  if (!comma?.monzo || !scale?.length || !xInterval || !yInterval) return null
  const moves = commaToTonnetzPath(comma.monzo, xInterval, yInterval)
  if (moves.length === 0) return null
  const xSteps = getBestApprox(edo, xInterval.ratio[0], xInterval.ratio[1])
  const ySteps = getBestApprox(edo, yInterval.ratio[0], yInterval.ratio[1])
  const positions = commaPathPositions(moves, xSteps, ySteps, edo)
  const N = scale.length
  const degrees = positions.map(p => {
    const pc = (((p.lx * xSteps + p.ly * ySteps) % edo) + edo) % edo
    let best = 0, bestD = Infinity
    for (let i = 0; i < N; i++) {
      const d = Math.min(Math.abs(scale[i] - pc), edo - Math.abs(scale[i] - pc))
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  })
  return degrees.length > 0 ? degrees : null
}

/** Fallback seed when no comma is selected: the scale itself, cycled. */
export function scaleCycleDegrees(scale) {
  return (scale ?? []).map((_, i) => i)
}

// ─── Knuckle detection ────────────────────────────────────────────────────────

/**
 * Find the transition temperature in a Phase 1 cooling history.
 * history: [{ temperature, cost }] in arrival order (temperature falling).
 * The knuckle is where the cost falls fastest per unit of log-temperature.
 * Costs are binned by log-T (25% bins) and median-averaged, so noisy
 * PROGRESS readings don't trigger on a single dip.
 * @returns {number|null} the transition temperature, or null if no
 *   knuckle has appeared yet (too few points, no real drop, or the
 *   steepest drop is not steeper than the general trend).
 */
export function detectTransition(history) {
  if (!history || history.length < 8) return null
  const pts = history.filter(p => p.temperature > 0 && Number.isFinite(p.cost))
  if (pts.length < 8) return null

  // Bin by log-T (each bin spans ×1.25 in temperature), median cost per bin.
  const binWidth = Math.log(1.25)
  const bins = new Map()
  for (const p of pts) {
    const key = Math.floor(Math.log(p.temperature) / binWidth)
    if (!bins.has(key)) bins.set(key, { temps: [], costs: [] })
    const b = bins.get(key)
    b.temps.push(p.temperature)
    b.costs.push(p.cost)
  }
  const ordered = [...bins.entries()]
    .sort((a, b) => b[0] - a[0]) // high temperature first
    .map(([, b]) => ({
      t: median(b.temps),
      cost: median(b.costs),
    }))
  if (ordered.length < 4) return null

  const plateau = ordered[0].cost
  const latest = ordered[ordered.length - 1].cost
  if (latest > 0.85 * plateau) return null // no real drop yet

  // Slope between consecutive bins: cost drop per unit log-T.
  const slopes = []
  for (let i = 0; i + 1 < ordered.length; i++) {
    const dLogT = Math.log(ordered[i].t) - Math.log(ordered[i + 1].t)
    if (dLogT <= 0) continue
    slopes.push({ slope: (ordered[i].cost - ordered[i + 1].cost) / dLogT, after: ordered[i + 1] })
  }
  if (slopes.length === 0) return null
  const medianSlope = median(slopes.map(s => s.slope))
  let best = null
  for (const s of slopes) {
    if (!best || s.slope > best.slope) best = s
  }
  // The steepest drop must stand out from the general trend, and it must
  // happen after the temperature has at least halved from the start.
  if (best.slope < 1.5 * Math.max(medianSlope, 0)) return null
  if (best.after.t > 0.5 * ordered[0].t) return null
  if (best.after.cost > 0.85 * plateau) return null
  return best.after.t
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
