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

// Cost of placing pitch p at index idx, given current neighbour pitches.
// Term 1: harmonic cost to all hypercube neighbours (includes cross-voice).
// Term 2: voice range cost (quadratic penalty away from voiceCenter).
export function computeNoteCost(idx, pitch, scoreArray, shape, strides, N, costTable, voiceSettings, weights) {
  const rangeWeight = weights?.rangeWeight ?? 1.0

  let cost = 0

  // Term 1
  const neighbors = getNeighborIndices(idx, shape, strides)
  for (const ni of neighbors) cost += costTable[pitch * N + scoreArray[ni]]

  // Term 2 — voice is the first dimension
  const voice = Math.floor(idx / strides[0])
  const vs = voiceSettings[voice] ?? { center: Math.floor(N / 2), range: N }
  const dist = Math.min(Math.abs(pitch - vs.center), N - Math.abs(pitch - vs.center))
  cost += rangeWeight * dist * dist

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
  }

  return total
}
