// Stride array for a shape, e.g. [3,6,6,6] → [216, 36, 6, 1].
export function computeStrides(shape) {
  const s = new Array(shape.length)
  s[shape.length - 1] = 1
  for (let k = shape.length - 2; k >= 0; k--) s[k] = s[k + 1] * shape[k + 1]
  return s
}

// Returns the 2×ndim flat neighbor indices for position idx (wrapping in all dims).
export function getNeighborIndices(idx, shape, strides) {
  const neighbors = []
  for (let k = 0; k < shape.length; k++) {
    const dk = shape[k]
    if (dk === 1) continue                             // degenerate dim — skip
    const pos = Math.floor(idx / strides[k]) % dk
    const base = idx - pos * strides[k]
    neighbors.push(base + ((pos + 1) % dk) * strides[k])
    neighbors.push(base + ((pos - 1 + dk) % dk) * strides[k])
  }
  return neighbors
}

// Returns the predecessor / successor of position idx in playback order
// (the linear order within its voice), wrapping within the voice —
// playback itself wraps pitch indices, so the sequence is cyclic.
// Empty when a voice holds a single note (no sequential neighbour exists).
export function getSequentialNeighbors(idx, shape, strides) {
  const perVoice = shape.slice(1).reduce((a, b) => a * b, 1)
  if (perVoice <= 1) return []
  const voiceStart = Math.floor(idx / strides[0]) * perVoice
  const pos = idx - voiceStart
  return [
    voiceStart + ((pos - 1 + perVoice) % perVoice),
    voiceStart + ((pos + 1) % perVoice),
  ]
}

// Cost of placing pitch p at index idx, given current neighbour pitches.
// Term 1: harmonic cost to all hypercube neighbours (includes cross-voice).
// Term 2: voice range cost (quadratic penalty away from voiceCenter).
// Term 3 (jumpWeight): melodic leap penalty — linear in the scale-degree
//   distance to the predecessor / successor in playback order. Without it
//   a note's immediate neighbours in time were only 1 of its 6 hypercube
//   neighbours, so lines leapt freely even when the harmony was consonant.
// Term 4 (thematicWeight): phrase-similarity penalty — one unit per
//   long-range hypercube neighbour (dims other than the voice dim and the
//   sequential last dim) whose pitch differs from p. It rewards a note for
//   matching the notes a section away, i.e. motif repetition across the
//   cube, beyond what the interval cost already rewards. It is a no-op for
//   shapes with no such dim (e.g. [voices, d]).
export function computeNoteCost(idx, pitch, scoreArray, shape, strides, N, costTable, voiceSettings, weights) {
  const rangeWeight = weights?.rangeWeight ?? 1.0
  const jumpWeight = weights?.jumpWeight ?? 0.0
  const thematicWeight = weights?.thematicWeight ?? 0.0

  let cost = 0

  // Term 1
  const neighbors = getNeighborIndices(idx, shape, strides)
  for (const ni of neighbors) cost += costTable[pitch * N + scoreArray[ni]]

  // Term 2 — voice is the first dimension
  const voice = Math.floor(idx / strides[0])
  const vs = voiceSettings[voice] ?? { center: Math.floor(N / 2), range: N }
  const dist = Math.min(Math.abs(pitch - vs.center), N - Math.abs(pitch - vs.center))
  cost += rangeWeight * dist * dist

  // Term 3 — sequential (melodic) neighbours, in scale degrees
  if (jumpWeight !== 0) {
    for (const ni of getSequentialNeighbors(idx, shape, strides)) {
      cost += jumpWeight * Math.abs(pitch - scoreArray[ni])
    }
  }

  // Term 4 — long-range (thematic) neighbours: dims other than voice (0)
  // and the sequential last dim.
  if (thematicWeight !== 0 && shape.length > 2) {
    for (let k = 1; k < shape.length - 1; k++) {
      const dk = shape[k]
      if (dk === 1) continue
      const pos = Math.floor(idx / strides[k]) % dk
      const base = idx - pos * strides[k]
      const plus = base + ((pos + 1) % dk) * strides[k]
      const minus = base + ((pos - 1 + dk) % dk) * strides[k]
      if (scoreArray[plus] !== pitch) cost += thematicWeight
      if (scoreArray[minus] !== pitch) cost += thematicWeight
    }
  }

  return cost
}

// Gibbs-sample a new pitch for position idx.
// weight(p) = exp(-(cost(p) - minCost) / T)  — shifted for numerical stability.
export function pickPitch(idx, scoreArray, shape, strides, N, costTable, voiceSettings, weights, temperature) {
  const costs = new Float32Array(N)
  for (let p = 0; p < N; p++) {
    costs[p] = computeNoteCost(idx, p, scoreArray, shape, strides, N, costTable, voiceSettings, weights)
  }

  let minCost = costs[0]
  for (let p = 1; p < N; p++) if (costs[p] < minCost) minCost = costs[p]

  let total = 0
  const w = new Float32Array(N)
  for (let p = 0; p < N; p++) {
    w[p] = Math.exp(-(costs[p] - minCost) / temperature)
    total += w[p]
  }

  let r = Math.random() * total
  for (let p = 0; p < N; p++) {
    r -= w[p]
    if (r <= 0) return p
  }
  return N - 1
}

// Sum of all per-note costs for the current scoreArray state.
// Each undirected edge is counted twice (once per endpoint), which is
// consistent with computeNoteCost and produces the correct energy shape.
export function computeTotalCost(scoreArray, shape, strides, N, costTable, voiceSettings, weights) {
  const rangeWeight = weights?.rangeWeight ?? 1.0
  const jumpWeight = weights?.jumpWeight ?? 0.0
  const thematicWeight = weights?.thematicWeight ?? 0.0
  let total = 0

  for (let idx = 0; idx < scoreArray.length; idx++) {
    const p = scoreArray[idx]

    // Term 1 — count only +1 neighbours to avoid double-counting edges
    for (let k = 0; k < shape.length; k++) {
      const dk = shape[k]
      if (dk === 1) continue
      const pos = Math.floor(idx / strides[k]) % dk
      const ni = idx - pos * strides[k] + ((pos + 1) % dk) * strides[k]
      total += costTable[p * N + scoreArray[ni]]
    }

    // Term 2 — per-note, no double-counting
    const voice = Math.floor(idx / strides[0])
    const vs = voiceSettings[voice] ?? { center: Math.floor(N / 2), range: N }
    const dist = Math.min(Math.abs(p - vs.center), N - Math.abs(p - vs.center))
    total += rangeWeight * dist * dist

    // Term 3 — count only the +1 sequential neighbour (cyclic within the
    // voice, so every sequential edge is counted exactly once)
    if (jumpWeight !== 0) {
      const [, next] = getSequentialNeighbors(idx, shape, strides)
      if (next !== undefined) total += jumpWeight * Math.abs(p - scoreArray[next])
    }

    // Term 4 — count only +1 neighbours in the long-range dims
    if (thematicWeight !== 0 && shape.length > 2) {
      for (let k = 1; k < shape.length - 1; k++) {
        const dk = shape[k]
        if (dk === 1) continue
        const pos = Math.floor(idx / strides[k]) % dk
        const ni = idx - pos * strides[k] + ((pos + 1) % dk) * strides[k]
        if (scoreArray[ni] !== p) total += thematicWeight
      }
    }
  }

  return total
}
