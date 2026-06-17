import { monzoToRatio, monzoToCents } from './commaUtils'

function line(label, value) {
  return `${label}: ${value}`
}

function section(title) {
  const bar = '─'.repeat(40)
  return `\n${bar}\n${title}\n${bar}`
}

/**
 * Serialize the full app state to a human-readable plain-text string.
 * @param {object} state  The App reducer state (or a subset thereof)
 * @returns {string}
 */
export function serializeSettings(state) {
  const lines = []

  lines.push('Microtonal Composer — Settings Export')
  lines.push(`Exported: ${new Date().toISOString()}`)

  // ── Step 1: Tuning ────────────────────────────────────────────────────────
  lines.push(section('Step 1 — Tuning'))
  lines.push(line('EDO', state.edo))
  lines.push(line('Primes', state.primes.join(', ')))

  // ── Step 2: Tonnetz ───────────────────────────────────────────────────────
  lines.push(section('Step 2 — Tonnetz'))
  lines.push(line('X axis interval', formatInterval(state.xInterval)))
  lines.push(line('Y axis interval', formatInterval(state.yInterval)))

  // ── Step 3: Scale / Comma ─────────────────────────────────────────────────
  lines.push(section('Step 3 — Scale'))
  if (state.selectedComma) {
    const { monzo, bestEdo } = state.selectedComma
    const { numerator, denominator } = monzoToRatio(monzo)
    const cents = monzoToCents(monzo).toFixed(4)
    lines.push(line('Comma monzo', `[${monzo.join(' ')} >`))
    lines.push(line('Comma ratio', `${numerator}/${denominator}`))
    lines.push(line('Comma cents', cents))
    lines.push(line('Comma bestEdo', bestEdo))
  } else {
    lines.push('Comma: (none selected)')
  }
  if (state.scale) {
    lines.push(line('Scale degrees', state.scale.length))
    lines.push(line('Scale EDO steps', state.scale.join(', ')))
  } else {
    lines.push('Scale: (none)')
  }

  // ── Step 4: Cost Function ─────────────────────────────────────────────────
  lines.push(section('Step 4 — Cost Function'))
  const cp = state.costParams
  lines.push(line('Cost power',      cp.power))
  lines.push(line('Max P·Q',         cp.maxPQ))
  lines.push(line('Proximity K',     cp.proximityK))
  lines.push(line('Voice count',     state.voiceCount))
  state.voiceSettings.forEach((vs, i) => {
    lines.push(line(`Voice ${i + 1} center Hz`, vs.centerHz))
  })

  // ── Step 5: Composition ───────────────────────────────────────────────────
  lines.push(section('Step 5 — Composition'))
  lines.push(line('Score array shape',  state.cubeDims.join(' × ')))
  lines.push(line('Range weight',       state.weights.rangeWeight))
  lines.push(line('Jump weight',        state.weights.jumpWeight))
  lines.push(line('Thematic weight',    state.weights.thematicWeight))

  const rs = state.rhythmSettings
  lines.push(line('Rhythm mode',        rs.mode))
  lines.push(line('Measure duration',   `${rs.measureSec} s`))
  if (rs.mode === 'simple') {
    lines.push(line('Rhythm divisor',   rs.divisor))
  } else {
    lines.push(line('Allowed divisors', rs.allowedDivisors.join(', ')))
    lines.push(line('Min note',         `${rs.minNoteSec} s`))
    lines.push(line('Rest probability', rs.restProb))
    lines.push(line('Join probability', rs.joinProb))
    lines.push(line('Independent voices', rs.independentVoices))
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────
  lines.push(section(`Snapshots (${state.snapshots.length})`))
  if (state.snapshots.length === 0) {
    lines.push('(none)')
  } else {
    state.snapshots.forEach((snap, i) => {
      lines.push(`\nSnapshot ${i + 1}:`)
      lines.push(line('  Temperature',  snap.temperature?.toFixed(4) ?? '–'))
      lines.push(line('  Total cost',   snap.totalCost?.toFixed(4)   ?? '–'))
      if (snap.scale)  lines.push(line('  Scale steps', snap.scale.join(', ')))
      if (snap.edo)    lines.push(line('  EDO',         snap.edo))
    })
  }

  lines.push('')  // trailing newline
  return lines.join('\n')
}

function formatInterval(interval) {
  if (!interval) return '–'
  if (interval.ratio) return `${interval.ratio[0]}/${interval.ratio[1]}`
  if (interval.cents != null) return `${interval.cents} ¢`
  return JSON.stringify(interval)
}
