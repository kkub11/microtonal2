import {
  computeStrides,
  getNeighborIndices,
  pickPitch,
  computeTotalCost,
} from '../utils/annealing.js'

// ─── Worker state ────────────────────────────────────────────────────────────

let s = null  // initialized by INIT message

// ─── Message handler ─────────────────────────────────────────────────────────

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'INIT':
      init(data)
      break
    case 'SET_TEMPERATURE':
      if (s) s.temperature = data.value
      break
    case 'SNAPSHOT':
      if (s) sendSnapshot()
      break
    case 'PAUSE':
      if (s) s.paused = true
      break
    case 'RESUME':
      if (s && s.paused) { s.paused = false; scheduleBatch() }
      break
    case 'RESET':
      if (s) reset(data.initMode, data.seed)
      break
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────

function init(data) {
  const shape   = data.scoreShape          // e.g. [3, 6, 6, 6]
  const strides = computeStrides(shape)
  const total   = shape.reduce((a, b) => a * b, 1)

  s = {
    costTable:     data.costTable,         // Float32Array N×N
    N:             data.N,                 // scale size
    shape,
    strides,
    total,
    voiceSettings: data.voiceSettings ?? [],
    weights:       data.weights ?? { rangeWeight: 1.0 },
    temperature:   data.temperature ?? 200,
    paused:        false,
    scoreArray:    new Int16Array(total),
    iteration:     0,
    totalCost:     0,
  }

  reset(data.initMode, data.seed)
}

// ─── Reset ────────────────────────────────────────────────────────────────────

function reset(initMode, seed) {
  const { total, N, scoreArray } = s

  if (initMode === 'seed' && seed) {
    // Fill score array by cycling through the provided seed sequence.
    for (let i = 0; i < total; i++) scoreArray[i] = seed[i % seed.length]
  } else {
    // Random initialization (Phase 1 / default).
    for (let i = 0; i < total; i++) scoreArray[i] = Math.floor(Math.random() * N)
  }

  s.iteration = 0
  s.totalCost = computeTotalCost(s.scoreArray, s.shape, s.strides, s.N, s.costTable, s.voiceSettings, s.weights)
  s.paused = false
  scheduleBatch()
}

// ─── Annealing loop ───────────────────────────────────────────────────────────

const BATCH     = 2000    // iterations per setTimeout cycle
const PROGRESS_EVERY = 10 // batches between PROGRESS messages

function scheduleBatch() {
  setTimeout(runBatch, 0)
}

function runBatch() {
  if (!s || s.paused) return

  const { scoreArray, shape, strides, N, costTable, voiceSettings, weights, total } = s

  for (let i = 0; i < BATCH; i++) {
    const idx = Math.floor(Math.random() * total)
    scoreArray[idx] = pickPitch(idx, scoreArray, shape, strides, N, costTable, voiceSettings, weights, s.temperature)
  }

  s.iteration += BATCH

  const batchNum = Math.floor(s.iteration / BATCH)
  if (batchNum % PROGRESS_EVERY === 0) {
    s.totalCost = computeTotalCost(scoreArray, shape, strides, N, costTable, voiceSettings, s.weights)
    self.postMessage({
      type:        'PROGRESS',
      temperature: s.temperature,
      totalCost:   s.totalCost,
      iteration:   s.iteration,
    })
  }

  scheduleBatch()
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

function sendSnapshot() {
  const copy = new Int16Array(s.scoreArray)  // copy, not transfer
  s.totalCost = computeTotalCost(s.scoreArray, s.shape, s.strides, s.N, s.costTable, s.voiceSettings, s.weights)
  self.postMessage({
    type:        'SNAPSHOT',
    scoreArray:  copy,
    scoreShape:  s.shape,
    temperature: s.temperature,
    totalCost:   s.totalCost,
    iteration:   s.iteration,
  }, [copy.buffer])
}
