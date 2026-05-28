// Returns true if stacking `gen` steps `size` times in `edo` produces a
// Moment of Symmetry (at most 2 distinct consecutive step sizes) with all
// distinct pitch classes.
function isMOS(edo, gen, size) {
  const pitches = new Set()
  for (let i = 0; i < size; i++) {
    const p = (i * gen) % edo
    if (pitches.has(p)) return false  // repeated pitch class
    pitches.add(p)
  }
  const arr = Array.from(pitches).sort((a, b) => a - b)
  const stepSizes = new Set()
  for (let i = 0; i < size; i++) {
    stepSizes.add((arr[(i + 1) % size] - arr[i] + edo) % edo)
  }
  return stepSizes.size <= 2
}

// Returns primary MOS scale sizes for a given generator in an EDO.
// Trims the near-chromatic tail by detecting the first trio of consecutive
// integers (which signals "almost full EDO" scales, not useful musically).
export function findMOSSizes(edo, generatorSteps) {
  const g = ((generatorSteps % edo) + edo) % edo
  if (g === 0) return []
  const all = []
  for (let size = 2; size < edo; size++) {
    if (isMOS(edo, g, size)) all.push(size)
  }
  // Trim the near-chromatic tail: 3+ consecutive integers starting at size >= edo/3.
  // The threshold prevents early small MOS sizes like [2,3,4] from triggering the cut.
  const tailThreshold = Math.ceil(edo / 3)
  for (let i = 2; i < all.length; i++) {
    if (
      all[i - 2] >= tailThreshold &&
      all[i] - all[i - 1] === 1 &&
      all[i - 1] - all[i - 2] === 1
    ) {
      return all.slice(0, i - 1)
    }
  }
  return all
}

// Build a scale as a sorted array of EDO step indices using the generator.
export function buildScaleFromGenerator(edo, generatorSteps, size) {
  const g = ((generatorSteps % edo) + edo) % edo
  const pitches = []
  for (let i = 0; i < size; i++) {
    pitches.push((i * g) % edo)
  }
  return pitches.sort((a, b) => a - b)
}
