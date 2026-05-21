# Microtonal Composer Web App — Technical Reference for Claude Code

This document is the single source of truth for building this app.
Read it fully before writing any code.

---

## What We Are Building

An interactive web app for algorithmic microtonal music composition,
based on the system developed by Jim Kukula
(https://interdependentscience.blogspot.com).

The user configures a tuning system, selects a scale via a Tonnetz
diagram, chooses a comma to traverse, then runs a simulated annealing
algorithm that generates a multi-voice musical score. The score is
played back via the Web Audio API.

**Tech stack:** React, Tailwind CSS, Web Audio API.
**Data file:** `public/commas_best.txt` (29,999 lines, included in repo).

---

## Core Concepts (read before touching any algorithm code)

### EDO (Equal Division of the Octave)
Divide the octave into N equal steps. Frequency of step k:
`freq = baseHz * 2^(k / edo)`
Jim uses many EDOs: 19, 34, 53, 65, 87, 99, 114, 494, 612, etc.
The EDO is chosen to approximate desired just ratios well.

### Prime limit
A set of primes (e.g. [2,3,5] or [2,3,5,7,11,13]) that defines which
just intervals are considered consonant. Higher primes = more exotic
harmony.

### Just interval / ratio
A frequency ratio p:q built from small primes. Examples:
- 3:2 = perfect fifth (~702 cents)
- 5:4 = major third (~386 cents)
- 7:4 = harmonic seventh (~969 cents)
- 11:8 = eleventh harmonic (~551 cents)
- 13:8 = thirteenth harmonic (~841 cents)

### Tuning error
How closely an EDO approximates a just ratio.
`bestStep = round(edo * log2(p/q))`
`error = |edo * log2(p/q) - bestStep|` (in fractions of one EDO step)
Small error = good approximation.

### Tonnetz
A 2D grid where each cell is an EDO pitch class.
Moving right by dx steps = one interval (e.g. a fifth = 31 steps in 53edo).
Moving up by dy steps = another interval (e.g. a major third = 17 steps in 53edo).
The axes are user-configurable — any two intervals from the prime set.

### Comma
A very small interval: the gap left when a cycle of just intervals
fails to close exactly. Example: four perfect fifths + major third
≠ two octaves; the gap is the syntonic comma (81:80).

In an EDO, certain commas are "tempered out" — the EDO rounds them
to zero, so the cycle closes. This is what makes comma traversal
possible: you can follow a path of intervals that in just intonation
would drift, but in the EDO returns to the start.

### Comma file format (`commas_best.txt`)
Each line: `[e2 e3 e5 e7 e11 e13 > bestEdo`
The comma = 2^e2 * 3^e3 * 5^e5 * 7^e7 * 11^e11 * 13^e13
`bestEdo` = the EDO Jim recommends for traversing this comma.
29,999 entries. EDOs range from 12 to 1992.

### Scale
A subset of EDO pitch classes, ordered within one octave.
Built by stacking a generator interval on the Tonnetz.
Aim for reasonably even spacing between successive notes.
For two-prime commas: can be computed algorithmically (circulation method).
For three-or-more-prime commas: user selects notes manually on Tonnetz.

### Interval cost function
A precomputed N×N table (N = scale size) of costs between every pair
of scale degrees. Low cost = consonant (preferred by annealing).
See full algorithm below.

### Score array
A multi-dimensional array of pitch assignments.
Shape: [numVoices][d1][d2]...[dn] where d1*d2*...*dn = numMeasures.
Example: 3 voices, 4×4×4 = 64 measures → shape [3][4][4][4].
Each element = an index into the scale (0..N-1).
Neighbors in ANY dimension are harmonically related.
This multidimensional neighbor structure is what causes phase
transitions and fractal self-similarity.

### Annealing algorithm
Iteratively reassigns pitches to minimize total cost.
Each note event has ~6 neighbors (2 per dimension in the hypercube,
plus cross-voice neighbors). The cost function has multiple terms
(see below). Temperature controls randomness. Starting high and
cooling slowly allows global harmonic order to emerge spontaneously.

---

## Data Structures

```javascript
// Tuning setup
const tuning = {
  edo: 53,
  baseHz: 261.63,  // middle C
  primes: [2, 3, 5, 7],
};

// A just interval
const justInterval = {
  ratio: [3, 2],       // p:q
  cents: 701.96,
  name: "perfect fifth",
  color: "green",      // for Tonnetz display
};

// Tuning error table: errors[p][q] = error in fractions of 1 EDO step
// Computed for all pairs from selected primes

// A comma entry (parsed from commas_best.txt)
const comma = {
  monzo: [4, -10, 5, 0, -1, 1],  // exponents of [2,3,5,7,11,13]
  bestEdo: 494,
  cents: 0.0...,         // computed: 1200 * sum(e_i * log2(p_i))
  ratioString: "...",    // computed from monzo
  primeSet: [2,3,5,11,13],  // which primes appear (non-zero exponents)
};

// Scale: ordered EDO step indices within one octave
const scale = [0, 17, 31, 48, 62, ...];  // length N

// Interval cost table
// costTable[i][j] = cost of the interval from scale[i] to scale[j]
// Low = consonant (preferred). Range approximately 0.1 to 10.
const costTable = Float32Array(N * N);

// Score array (flattened, shape stored separately)
const scoreArray = Int16Array(numVoices * totalMeasures);
const scoreShape = [3, 4, 4, 4];  // [voices, ...dimensions]

// Note event (for audio playback)
const noteEvent = {
  freqHz: 440.0,
  startSec: 0.0,
  durationSec: 0.5,
  voice: 0,
};
```

---

## Algorithm: Interval Cost Function

Jim's exact method, from his email and blog posts:

**Step 1: Enumerate candidate just intervals**
For each prime p in the prime set, up to a maximum value `maxPQ` for
p and q, enumerate all ratios p:q that are within a reasonable cents
range (say ±50 cents) of the EDO interval being scored.
Include ratios in both ascending and descending form.

**Step 2: For each just interval p:q, compute Tenney harmonic distance**
```
tenney(p, q) = log2(p * q)
```
Simple intervals score low (3:2 → 2.58), complex ones score high.

**Step 3: Compute proximity penalty**
How close is this just ratio to the actual EDO interval in cents?
```
proximityFactor = exp(-proximityK * abs(justCents - edoCents))
```
A just interval that is far from the EDO interval contributes less.

**Step 4: Compute consonance contribution (inverted + powered)**
```
consonance = proximityFactor / pow(tenney(p, q), power)
```
`power` spreads out scores. Use small values (~1.0) for few primes,
larger (~2.0–3.0) for many primes, to prevent flattening.

**Step 5: Sum contributions, floored at 0.001**
```
score[i][j] = 0.001 + sum of consonance for all matching just ratios
```
The 0.001 floor ensures no interval gets score zero.

**Step 6: Invert to get final cost**
```
cost[i][j] = 1.0 / score[i][j]
```

**Step 7: Validate range**
Jim checks that the table has a range from ~0.1 to ~10.
The UI should display the min/max and let the user adjust `power`
and `maxPQ` until the range looks good.

**User-adjustable parameters:**
- `power` (slider 0.5–4.0): spreads score range
- `maxPQ` (number input, e.g. 100): limits which just ratios to include
- `proximityK` (slider): strictness of the proximity penalty

---

## Algorithm: Full Cost Function for Annealing

The cost of assigning pitch `p` to a note event has FOUR terms:

**Term 1: Harmonic neighbor cost**
For each neighbor of this note event in the score hypercube:
`cost += costTable[p][neighborPitch]`
This is the main musical term. Neighbors in all dimensions must be
consonant with each other.

**Term 2: Voice range cost**
Each voice has a center pitch and a range. Penalize pitches far from
center:
`cost += rangeWeight * abs(p - voiceCenter)^2`
This keeps voices from drifting too far in pitch.

**Term 3: Melodic jump cost**
Penalize large melodic leaps, but modulated by the interval cost:
`cost += jumpWeight * stepDistance(p, prevPitch) * costTable[p][prevPitch]`
Note: a dissonant small step can be worse than a consonant large leap
(e.g. an octave may be preferred over a dissonant half-step).

**Term 4: Interval comparison / thematic similarity cost (the "wild" term)**
From the January 2025 "Comparing Intervals" post:
When the same position in two different phrase repetitions is compared,
not only should those two pitches be consonant, but the *interval*
from the previous note to each should be similar.
`expectedPitch = prevPitch_b + (prevPitch_a → p_a interval)`
`cost += thematicWeight * costTable[p][expectedPitch]`
This encodes melodic shape preservation across variations of a phrase.

---

## Algorithm: Simulated Annealing

```
1. Initialize scoreArray randomly (or with a comma traversal pattern)
2. Set temperature T = T_start (high, e.g. 5000)
3. Repeat many millions of times:
   a. Pick a random note event (voice, position in hypercube)
   b. Compute total cost of all 4 terms for current pitch
   c. Pick a candidate new pitch from the scale (weighted by cost)
   d. Compute cost of candidate pitch
   e. If candidate cost < current cost: accept
      Else: accept with probability exp(-(newCost - oldCost) / T)
   f. Periodically decrease T by factor ~0.99 or similar schedule
4. At each temperature snapshot, optionally save the state
5. Sweet spot is near the phase transition temperature where
   total system cost drops suddenly
```

**Temperature schedule:** Jim starts very high and multiplies by a
factor < 1.0 each round. The graph in the Oct 2025 "Emergent Order"
post shows a sudden cost drop around temperature 230 for a 34edo piece,
with temperatures ranging from ~5000 down to ~50.

**Initialization options:**
- Random: start fully random, let order emerge
- Seeded traversal: initialize with a repeated comma traversal pattern,
  then fix temperature at the observed transition point

**Neighbor topology:**
Each note event at position [v][d1][d2]...[dn] has neighbors:
- 2 neighbors per dimension (±1, wrapping)
- 1 cross-voice neighbor (same position, adjacent voice)
Total ~5–7 neighbors per note event.

---

## Algorithm: Score to Audio

**Rhythm:**
- Measures are equal length
- Each measure is divided into note events
- Duration divisions: ÷2, ÷3, ÷4, ÷5 (user selects which are allowed)
- Multiple patterns of divisions per piece (up to 8 different patterns)
- Patterns distributed across measures recursively (DDCDDCBDDCDDCBA...)
- Pattern assignment can be correlated or independent between voices

**Pitch to frequency:**
`freqHz = baseHz * 2^(scaleStep / edo)`

**Web Audio synthesis:**
- OscillatorNode + GainNode per note
- Waveform: sine / triangle / sawtooth (user selects)
- Schedule using audioCtx.currentTime offsets (not setTimeout)
- Envelope: short attack + decay to avoid clicks

---

## Component Architecture

```
<App>
├── <Header />
├── <WorkflowStepper steps={1..6} current={step} />
│
├── [Step 1] <TuningPanel>
│   ├── <EdoSelector />           number input; suggest from comma bestEdo
│   ├── <PrimeSelector />         toggles for 3, 5, 7, 11, 13
│   └── <TuningErrorTable />      computed grid, rows×cols = prime pairs
│
├── [Step 2] <TonnetzPanel>
│   ├── <AxisPicker axis="x" />   pick interval from prime set
│   ├── <AxisPicker axis="y" />   pick interval from prime set
│   └── <TonnetzGrid />           SVG; cells = pitch classes; arrows = intervals
│
├── [Step 3] <CommaScalePanel>
│   ├── <CommaList />             filtered by selected primes + edo
│   ├── <CommaDetail />           shows path on Tonnetz, cents size
│   └── <ScaleBuilder />          auto (2-prime) or manual (3+ prime)
│
├── [Step 4] <CostFunctionPanel>
│   ├── <CostParams />            power, maxPQ, proximityK sliders
│   ├── <CostTable />             colored N×N grid, shows min/max range
│   └── <VoiceSettings />         center pitch + range per voice
│
├── [Step 5] <CompositionPanel>
│   ├── <ArrayShapeSelector />    e.g. 4×4×4, 7×7×7, 12×12
│   ├── <VoiceCountSelector />    1–4
│   ├── <TemperatureControls />   T_start, cooling rate, num iterations
│   ├── <RhythmSelector />        checkboxes ÷2 ÷3 ÷4 ÷5
│   ├── <WeightSliders />         rangeWeight, jumpWeight, thematicWeight
│   ├── <GenerateButton />        runs annealing (web worker)
│   └── <EnergyGraph />           live cost vs temperature plot
│
└── [Step 6] <OutputPanel>
    ├── <FoldedScore />           SVG: time on x, pitch (mod octave) on y
    ├── <PlaybackControls />      play/pause/stop, tempo BPM
    ├── <WaveformSelector />      sine/triangle/sawtooth
    └── <AudioEngine />           invisible Web Audio manager
```

---

## File Structure

```
src/
  utils/
    edoUtils.js         frequency math, tuning error computation
    commaUtils.js       parse commas_best.txt, filter, monzo math
    costFunction.js     interval cost table builder
    annealing.js        simulated annealing engine
    audioEngine.js      Web Audio API scheduler
    rhythmUtils.js      measure division, pattern distribution
  components/
    Header.jsx
    WorkflowStepper.jsx
    TuningPanel/
      index.jsx
      EdoSelector.jsx
      PrimeSelector.jsx
      TuningErrorTable.jsx
    TonnetzPanel/
      index.jsx
      AxisPicker.jsx
      TonnetzGrid.jsx
    CommaScalePanel/
      index.jsx
      CommaList.jsx
      CommaDetail.jsx
      ScaleBuilder.jsx
    CostFunctionPanel/
      index.jsx
      CostParams.jsx
      CostTable.jsx
      VoiceSettings.jsx
    CompositionPanel/
      index.jsx
      ArrayShapeSelector.jsx
      VoiceCountSelector.jsx
      TemperatureControls.jsx
      RhythmSelector.jsx
      WeightSliders.jsx
      GenerateButton.jsx
      EnergyGraph.jsx
    OutputPanel/
      index.jsx
      FoldedScore.jsx
      PlaybackControls.jsx
      WaveformSelector.jsx
      AudioEngine.jsx
  workers/
    annealing.worker.js   run annealing in background thread
  App.jsx
  main.jsx
public/
  commas_best.txt
```

---

## Build Order (one session per item)

1. `edoUtils.js` — getStepFreq, getBestApprox, computeTuningError
2. `commaUtils.js` — parse file, monzoToCents, monzoToRatio, filterCommas
3. `<TuningPanel>` — EDO input, prime toggles, tuning error table display
4. `<TonnetzGrid>` — SVG grid with configurable axes and interval arrows
5. `<CommaList>` + `<CommaDetail>` — filterable comma selector
6. `<ScaleBuilder>` — auto (2-prime circulation) + manual Tonnetz picker
7. `costFunction.js` + `<CostTable>` display with param sliders
8. `annealing.js` in a Web Worker — test with console output first
9. `<CompositionPanel>` + `<EnergyGraph>` — wire up annealing
10. `rhythmUtils.js` + `audioEngine.js` — score to note events to sound
11. `<FoldedScore>` — SVG visualization
12. Polish, accessibility, Tailwind theming

---

## Important Implementation Notes

- **Annealing must run in a Web Worker** — it runs millions of iterations
  and will freeze the UI if run on the main thread. Use postMessage to
  send progress updates (current temperature, total cost) back to the
  main thread for the EnergyGraph.

- **commas_best.txt is large** — fetch it once on app load, parse into
  a JS array, store in React context. Do not re-fetch on every render.

- **Monzo arithmetic uses large integers** — numerators/denominators of
  commas like [4,-10,5,0,-1,1] can exceed Number.MAX_SAFE_INTEGER.
  Use BigInt for ratio computation. Cents values are fine as Float64.

- **Cost table size** — for a 20-note scale, the table is 20×20 = 400
  entries, trivial. For a 52-note scale, 2704 entries, still fine.

- **Audio scheduling** — always use audioCtx.currentTime + offset for
  scheduling. Never use setTimeout for audio timing. Create a new
  AudioContext only on user gesture (browser requirement).

- **The phase transition temperature varies** — it depends on EDO, scale,
  and cost function. The EnergyGraph should make it visually obvious
  where the transition is so the user can identify the sweet spot.

- **Score array indexing** — flatten the multi-dimensional array to 1D
  for performance. Store shape separately. Neighbor lookup must wrap
  around (modular arithmetic) in each dimension.

---

## Key Blog Posts for Reference

- Algorithm overview: https://interdependentscience.blogspot.com/2025/10/emergent-order.html
- Original fractal music: https://interdependentscience.blogspot.com/2015/09/fractal-music.html
- Interval comparison term: https://interdependentscience.blogspot.com/2025/01/comparing-intervals.html
- Extended consonance (7,11,13): https://interdependentscience.blogspot.com/2026/02/extended-consonance.html
- Scale circulation method: https://interdependentscience.blogspot.com/2024/12/circulating-and-traversing.html
- Comma traversal example: https://interdependentscience.blogspot.com/2026/02/magic.html
- Rhythmic structure: https://interdependentscience.blogspot.com/2026/01/tamp-it-down.html
- All parameters described: https://interdependentscience.blogspot.com/2026/01/lost-in-space.html
