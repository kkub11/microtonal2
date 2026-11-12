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

// Returns the predecessor of position idx in playback order (the linear
// order within its voice), wrapping within the voice. -1 when a voice
// holds a single note (no sequential neighbour exists).
export function getPredecessorIndex(idx, shape, strides) {
  const perVoice = shape.slice(1).reduce((a, b) => a * b, 1)
  if (perVoice <= 1) return -1
  const voiceStart = Math.floor(idx / strides[0]) * perVoice
  const pos = idx - voiceStart
  return voiceStart + ((pos - 1 + perVoice) % perVoice)
}

// Long-range (thematic) neighbour indices: dims other than the voice
// dim (0) and the sequential last dim. These are the positions that hold
// "the same position in a different section" — the substrate of Term 4.
// Empty for shapes with no such dim (e.g. [voices, d]).
export function getThematicNeighbors(idx, shape, strides) {
  const out = []
  if (shape.length <= 2) return out
  for (let k = 1; k < shape.length - 1; k++) {
    const dk = shape[k]
    if (dk === 1) continue
    const pos = Math.floor(idx / strides[k]) % dk
    const base = idx - pos * strides[k]
    out.push(base + ((pos + 1) % dk) * strides[k])
    out.push(base + ((pos - 1 + dk) % dk) * strides[k])
  }
  return out
}

// Jim's full Term 4: the melodic interval leading into p should match
// the interval leading into its long-range partner p'. expected is where
// p "should" be if its phrase is a transposed copy of the partner's:
// the partner's step (p' - prev') applied to p's own predecessor.
// The penalty is the interval cost between p and its expected pitch,
// so a mismatch that still sounds consonant is cheap. Degree
// differences are raw (as in the jump term); the expected pitch wraps
// mod N. When the intervals match, expected === p and the cost is the
// table's (floored) unison cost — the minimum.
export function transposedMatchCost(p, prev, partnerPitch, partnerPrev, N, costTable, thematicWeight) {
  const expected = (((prev + (partnerPitch - partnerPrev)) % N) + N) % N
  return thematicWeight * costTable[p * N + expected]
}

// Cost of a melodic step of d scale degrees, × jumpWeight. U-shaped:
//   d = 0 (repeat the note) → repeatCost (default 2.0; measured on
//   53-EDO MOS7 at T20: repeats 27% at 0.5, 23% at 1.0, 18% at 2.0,
//   with stepwise motion rising 34% → 38% → 42% and entropy ~2.1 throughout)
//   d = 1 (step to a neighbouring degree) → 0 — steps are the cheapest motion
//   d ≥ 2 → d - 1 — leaps grow linearly
// A purely linear penalty made repeats the cheapest escape (cost 0), so
// lines degenerated into long runs of one note; the U-shape makes stepwise
// motion the preferred motion instead, with repeats and small leaps as
// the next-cheapest options.
export function sequentialStepCost(stepDistance, jumpWeight, repeatCost = 2.0) {
  if (stepDistance === 0) return jumpWeight * repeatCost
  if (stepDistance === 1) return 0
  return jumpWeight * (stepDistance - 1)
}

// Cost of placing pitch p at index idx, given current neighbour pitches.
// Term 1: harmonic cost to all hypercube neighbours (includes cross-voice).
// Term 2: voice range cost (quadratic penalty away from voiceCenter).
// Term 3 (jumpWeight): melodic step cost — U-shaped (see sequentialStepCost).
//   Without it a note's immediate neighbours in time were only 1 of its 6
//   hypercube neighbours, so lines leapt freely even when the harmony was
//   consonant.
// Term 4 (thematicWeight): phrase-similarity penalty over the
// long-range hypercube neighbours (dims other than the voice dim and
// the sequential last dim) — the notes a section away, i.e. the same
// position in a different phrase repetition.
//   Off (default): one unit per neighbour whose pitch differs from p —
//   plain repetition.
//   On (thematicTransposed): Jim's full design — the melodic interval
//   leading into p should match the interval leading into the partner,
//   so a phrase may come back shifted, not just repeated. The penalty
//   is the interval cost between p and its expected (transposed) pitch.
// It is a no-op for shapes with no such dim (e.g. [voices, d]).
export function computeNoteCost(idx, pitch, scoreArray, shape, strides, N, costTable, voiceSettings, weights) {
  const rangeWeight = weights?.rangeWeight ?? 1.0
  const jumpWeight = weights?.jumpWeight ?? 0.0
  const thematicWeight = weights?.thematicWeight ?? 0.0
  const thematicTransposed = weights?.thematicTransposed ?? false
  const repeatCost = weights?.repeatCost ?? 2.0

  let cost = 0

  // Term 1
  const neighbors = getNeighborIndices(idx, shape, strides)
  for (const ni of neighbors) cost += costTable[pitch * N + scoreArray[ni]]

  // Term 2 — voice is the first dimension
  const voice = Math.floor(idx / strides[0])
  const vs = voiceSettings[voice] ?? { center: Math.floor(N / 2), range: N }
  const dist = Math.min(Math.abs(pitch - vs.center), N - Math.abs(pitch - vs.center))
  cost += rangeWeight * dist * dist

  // Term 3 — sequential (melodic) neighbours, U-shaped step cost
  if (jumpWeight !== 0) {
    for (const ni of getSequentialNeighbors(idx, shape, strides)) {
      cost += sequentialStepCost(Math.abs(pitch - scoreArray[ni]), jumpWeight, repeatCost)
    }
  }

  // Term 4 — long-range (thematic) neighbours
  if (thematicWeight !== 0 && shape.length > 2) {
    if (!thematicTransposed) {
      for (const ni of getThematicNeighbors(idx, shape, strides)) {
        if (scoreArray[ni] !== pitch) cost += thematicWeight
      }
    } else {
      const prevIdx = getPredecessorIndex(idx, shape, strides)
      if (prevIdx >= 0) {
        for (const ni of getThematicNeighbors(idx, shape, strides)) {
          const nPrevIdx = getPredecessorIndex(ni, shape, strides)
          if (nPrevIdx < 0) continue
          cost += transposedMatchCost(
            pitch, scoreArray[prevIdx], scoreArray[ni], scoreArray[nPrevIdx],
            N, costTable, thematicWeight)
        }
      }
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
  const thematicTransposed = weights?.thematicTransposed ?? false
  const repeatCost = weights?.repeatCost ?? 2.0
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
      if (next !== undefined) total += sequentialStepCost(Math.abs(p - scoreArray[next]), jumpWeight, repeatCost)
    }

    // Term 4 — the simple form counts only +1 neighbours (the rule is
    // symmetric, so once per undirected edge). The transposed form is
    // directed (the cost of p given its partner differs from the cost
    // of the partner given p), so it sums both directions: every
    // neighbour of every position.
    if (thematicWeight !== 0 && shape.length > 2) {
      if (!thematicTransposed) {
        for (let k = 1; k < shape.length - 1; k++) {
          const dk = shape[k]
          if (dk === 1) continue
          const pos = Math.floor(idx / strides[k]) % dk
          const ni = idx - pos * strides[k] + ((pos + 1) % dk) * strides[k]
          if (scoreArray[ni] !== p) total += thematicWeight
        }
      } else {
        const prevIdx = getPredecessorIndex(idx, shape, strides)
        if (prevIdx >= 0) {
          for (const ni of getThematicNeighbors(idx, shape, strides)) {
            const nPrevIdx = getPredecessorIndex(ni, shape, strides)
            if (nPrevIdx < 0) continue
            total += transposedMatchCost(
              p, scoreArray[prevIdx], scoreArray[ni], scoreArray[nPrevIdx],
              N, costTable, thematicWeight)
          }
        }
      }
    }
  }

  return total
}
