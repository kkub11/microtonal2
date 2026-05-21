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
Jim uses many EDOs. The range below 100 is a vast musical universe.
EDOs Jim has used: 19, 22, 34, 53, 65, 87, 99, 114, 494, 612.
The EDO is chosen to approximate desired just ratios well.

### Prime limit
A set of primes that defines which just intervals are considered
consonant. The standard set is [2, 3, 5, 7, 11, 13], but Jim has
used prime 17 and potentially higher. The UI must support arbitrary
primes, not just a fixed list.

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
Moving right = one interval (e.g. a fifth = 31 steps in 53-EDO).
Moving up = another interval (e.g. a major third = 17 steps in 53-EDO).
The axes are user-configurable — any two intervals from the prime set.
Conventional default: x = perfect fifth (3:2), y = major third (5:4).

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
Note: the file only covers primes up to 13. Commas involving primes
17+ would need to be computed separately if the user selects them.

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
Neighbor topology WRAPS — position 0 and position d-1 are neighbors.
This wrapping + multidimensional structure causes phase transitions
and fractal self-similarity.

### Annealing algorithm
Iteratively reassigns pitches to minimize total cost.
Each note event has ~6 neighbors (2 per dimension in the hypercube,
plus cross-voice neighbors). The cost function has multiple terms
(see below). Temperature controls randomness. Starting high and
cooling slowly allows global harmonic order to emerge spontaneously.

RUNTIME WARNING: The annealing algorithm runs for many millions of
iterations and can take hours or even a full day for large EDOs or
large arrays. Larger EDOs take longer because there are more pitch
candidates to evaluate at each step. The UI must handle this gracefully
via a snapshot system (see below) — do not assume a quick "done" state.

---

## Data Structures

```javascript
// Tuning setup
const tuning = {
  edo: 53,
  baseHz: 261.63,  // middle C
  primes: [2, 3, 5, 7],  // can include 11, 13, 17, or any prime
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
  cents: 0.0,            // computed: 1200 * sum(e_i * log2(p_i))
  ratioString: "...",    // computed from monzo using BigInt
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
const scoreShape = [3, 4, 4, 4];  // [voices, ...hypercube dimensions]

// A snapshot (saved state of the annealing run)
const snapshot = {
  temperature: 230.5,
  totalCost: 1992138.3,
  scoreArray: Int16Array(...),  // copy of scoreArray at this moment
  scoreShape: [3, 4, 4, 4],
};

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

Jim's exact method, from his emails and blog posts:

**Step 1: Enumerate candidate just intervals**
For each combination of primes from the selected prime set, enumerate
all ratios p:q where p and q are within `maxPQ`. Find all ratios
whose cents value is within ±50 cents of the EDO interval being scored.
Include ratios in both ascending and descending form.

**Step 2: For each just interval p:q, compute Tenney harmonic distance**
```
tenney(p, q) = log2(p * q)
```
Simple intervals score low (3:2 → 2.58), complex ones score high.

**Step 3: Compute proximity factor**
How close is this just ratio to the actual EDO interval in cents?
```
proximityFactor = exp(-proximityK * abs(justCents - edoCents))
```
A just interval far from the EDO interval contributes less.

**Step 4: Compute consonance contribution (inverted + powered)**
```
consonance = proximityFactor / pow(tenney(p, q), power)
```
`power` spreads out scores. Use small values (~1.0) for few primes,
larger (~2.0–3.0) for many primes. This counteracts the flattening
that occurs when more primes produce more just intervals per step.

**Step 5: Sum contributions, floored at 0.001**
```
score[i][j] = 0.001 + sum of consonance for all matching just ratios
```
The 0.001 floor ensures no interval ever gets score zero.

**Step 6: Invert to get final cost**
```
cost[i][j] = 1.0 / score[i][j]
```

**Step 7: Validate range**
Jim checks that the table has a range from ~0.1 to ~10 and manually
adjusts parameters until it looks right. The UI must display the
computed min/max cost and let the user adjust `power` and `maxPQ`
until the range is satisfactory.

**User-adjustable parameters:**
- `power` (slider 0.5–4.0): spreads score range; increase with more primes
- `maxPQ` (number input, e.g. 100): limits which just ratios are considered
- `proximityK` (slider): strictness of matching just ratio to EDO interval

---

## Algorithm: Full Cost Function for Annealing

The cost of assigning pitch `p` to a note event has FOUR terms:

**Term 1: Harmonic neighbor cost**
For each neighbor of this note event in the score hypercube:
`cost += costTable[p][neighborPitch]`
This is the main musical term. Neighbors in all hypercube dimensions
must be consonant with each other. Neighbors wrap (modular arithmetic).

**Term 2: Voice range cost**
Each voice has a center pitch and a range. Penalize pitches far from center:
`cost += rangeWeight * abs(p - voiceCenter)^2`
This keeps voices from drifting too far in pitch.

**Term 3: Melodic jump cost**
Penalize large melodic leaps, but modulated by the interval cost:
`cost += jumpWeight * stepDistance(p, prevPitch) * costTable[p][prevPitch]`
Note: a dissonant small step can be worse than a consonant large leap
(e.g. an octave may be preferred over a dissonant half-step).

**Term 4: Interval comparison / thematic similarity cost**
From Jim's January 2025 "Comparing Intervals" blog post.
When the same position in two different phrase repetitions is compared,
not only should those two pitches be consonant with each other, but
the *interval* from the previous note to each should be similar.
If snippet A plays notes [a1, a2] and snippet B plays [b1, b2],
the interval a1→a2 should match b1→b2. To encode this:
`expectedPitch_b2 = b1 + (a2 - a1)`  (in EDO steps)
`cost += thematicWeight * costTable[p][expectedPitch_b2]`
This encodes melodic shape preservation across variations of a phrase.

**Weight parameters (user-adjustable sliders):**
- `rangeWeight`: how strictly voices stay in their range
- `jumpWeight`: how much melodic jumps are penalized
- `thematicWeight`: how strongly phrase shapes are preserved

---

## Algorithm: Simulated Annealing

```
1. Initialize scoreArray randomly (or with a comma traversal seed pattern)
2. Set temperature T = T_start (high, e.g. 5000)
3. Repeat many millions of times:
   a. Pick a random note event (voice + position in hypercube)
   b. For each candidate pitch in the scale:
      - Compute total cost of all 4 terms
   c. Choose a pitch using weighted random selection:
      weight(p) = exp(-cost(p) / T)
   d. Assign the chosen pitch to this note event
   e. Periodically (e.g. every 100,000 iterations):
      - Decrease T by cooling factor (e.g. multiply by 0.98)
      - Compute total system cost (sum of all note event costs)
      - Report temperature + cost to UI via postMessage
      - If user has requested a snapshot, save current scoreArray
4. Sweet spot is near the phase transition where total cost drops suddenly
```

**Temperature schedule:**
Jim starts very high and multiplies by a factor < 1.0 each round.
The Oct 2025 "Emergent Order" post shows a sudden cost drop around
temperature 230 for a 34-EDO piece, with temperatures from ~5000 to ~50.
The exact transition temperature varies with EDO, scale, and cost function.

**Initialization options:**
- Random: start fully random, let order emerge spontaneously
- Seeded traversal: initialize with a repeated comma traversal pattern,
  then fix temperature at the observed transition point

**Neighbor topology (WRAPS):**
Each note event at position [v][i1][i2]...[in] has neighbors:
- For each dimension k: positions with ik±1 (mod dk) — WRAPS AROUND
- 1 cross-voice neighbor: same position, adjacent voice (also wraps)
Total ~5–7 neighbors per note event.
The wrapping is essential — it creates the toroidal topology that
enables the phase transition and fractal structure.

---

## Snapshot System (Critical UX Feature)

Because annealing can run for hours or days, the app MUST NOT treat
it as a blocking "generate then done" operation. Instead:

- The annealing runs continuously in a Web Worker
- The user can request a snapshot at any time via a button
- Snapshots are also taken automatically at regular temperature intervals
- Each snapshot saves: temperature, total cost, full scoreArray copy
- The EnergyGraph plots cost vs temperature; the user clicks on the
  curve to take a snapshot at that point or to select an existing one
- The OutputPanel (FoldedScore, playback) displays whichever snapshot
  is currently selected
- The user can compare multiple snapshots and pick the most musical one
- The annealing can be paused, resumed, or stopped at any time

This matches Jim's actual workflow: he takes 18 snapshots and listens
to each to find the sweet spot near the phase transition.

---

## EDO Selector Design

The EDO selector should have two modes:
1. **Preset dropdown** with named EDOs Jim has actually used:
   - 12 (standard Western, baseline reference)
   - 19 (meantone, conventional note names work)
   - 22 (magic comma territory)
   - 34 (diaschisma temperament)
   - 53 (Pythagorean/Hanson, very accurate fifths)
   - 65
   - 87
   - 99
   - 114
   - 494 (very high precision)
   - 612 (extreme precision)
2. **Custom number input** for any EDO the user wants to try

Below 100 is described by Jim as "already a vast universe."
Above 100 is "fun enough" but takes longer to compute.

---

## Prime Selector Design

Do NOT use a fixed list of checkboxes. The UI should:
1. Show standard primes as quick-toggle buttons: 3, 5, 7, 11, 13
2. Include an "Add prime" text input where the user can type any number
3. Validate that the entered number is actually prime before accepting
4. Display custom primes alongside the standard ones with a remove button
5. Note that the comma file (commas_best.txt) only covers primes 2,3,5,7,11,13.
   If the user selects prime 17 or higher, the comma file cannot be used
   for comma selection — warn the user and disable that step, or allow
   manual comma entry.

---

## Algorithm: Score to Audio

**Rhythm:**
- Measures are equal length
- Each measure is divided by one of: ÷2, ÷3, ÷4, or ÷5 (user enables each)
- Multiple different division patterns can exist in one piece
- Patterns distributed across measures recursively: DDCDDCBDDCDDCBA...
- Pattern assignment can be correlated or independent between voices

**Pitch to frequency:**
`freqHz = baseHz * 2^(scaleStep / edo)`

**Web Audio synthesis:**
- OscillatorNode + GainNode per note
- Waveform: sine / triangle / sawtooth (user selects)
- Schedule using audioCtx.currentTime offsets (NEVER setTimeout)
- Short attack + decay envelope on each note to avoid clicks
- Create AudioContext only on user gesture (browser security requirement)

---

## Component Architecture

```
<App>
├── <Header />
├── <WorkflowStepper steps={1..6} current={step} />
│
├── [Step 1] <TuningPanel>
│   ├── <EdoSelector />           preset dropdown + custom number input
│   ├── <PrimeSelector />         standard toggles + custom prime input
│   └── <TuningErrorTable />      computed grid, rows×cols = interval pairs
│
├── [Step 2] <TonnetzPanel>
│   ├── <AxisPicker axis="x" />   pick interval from prime set
│   ├── <AxisPicker axis="y" />   pick interval from prime set
│   └── <TonnetzGrid />           SVG; cells = pitch classes; colored arrows
│
├── [Step 3] <CommaScalePanel>
│   ├── <CommaList />             filtered by selected primes + edo
│   │                             disabled/warned if primes > 13
│   ├── <CommaDetail />           shows path on Tonnetz, cents size
│   └── <ScaleBuilder />          auto (2-prime) or manual (3+ prime)
│
├── [Step 4] <CostFunctionPanel>
│   ├── <CostParams />            power, maxPQ, proximityK sliders
│   ├── <CostTable />             colored N×N grid, shows min/max range
│   └── <VoiceSettings />         center pitch + range per voice
│
├── [Step 5] <CompositionPanel>
│   ├── <ArrayShapeSelector />    e.g. 4×4×4, 7×7×7, 12×12, 2^8
│   ├── <VoiceCountSelector />    1–4
│   ├── <TemperatureControls />   T_start, cooling rate
│   ├── <RhythmSelector />        checkboxes ÷2 ÷3 ÷4 ÷5
│   ├── <WeightSliders />         rangeWeight, jumpWeight, thematicWeight
│   ├── <RuntimeEstimate />       warn user if config will take a long time
│   ├── <GenerateButton />        start/pause/stop annealing (web worker)
│   ├── <EnergyGraph />           live cost vs temperature; click to snapshot
│   └── <SnapshotList />          list of saved snapshots; click to preview
│
└── [Step 6] <OutputPanel>
    ├── <SnapshotSelector />      which snapshot is being displayed/played
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
    annealing.js        simulated annealing engine (called from worker)
    audioEngine.js      Web Audio API scheduler
    rhythmUtils.js      measure division, pattern distribution
    primeUtils.js       primality test, prime enumeration
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
      RuntimeEstimate.jsx
      GenerateButton.jsx
      EnergyGraph.jsx
      SnapshotList.jsx
    OutputPanel/
      index.jsx
      SnapshotSelector.jsx
      FoldedScore.jsx
      PlaybackControls.jsx
      WaveformSelector.jsx
      AudioEngine.jsx
  workers/
    annealing.worker.js   Web Worker: runs annealing, posts progress + snapshots
  App.jsx
  main.jsx
public/
  commas_best.txt
```

---

## Build Order (one Claude Code session per item)

Session 1 is DONE (TuningPanel exists). Continue from session 2.

1. ~~`edoUtils.js` + `<TuningPanel>`~~ DONE
2. ~~`primeUtils.js` — isPrime, nextPrime; update PrimeSelector to support
   custom prime input and validate entries~~ DONE
3. ~~`commaUtils.js` — parse commas_best.txt, monzoToCents, monzoToRatio
   (BigInt), filterCommas by primes and edo~~ DONE
4. `<TonnetzGrid>` — SVG grid with configurable axes and colored arrows
5. `<CommaList>` + `<CommaDetail>` — filterable comma selector wired to
   commaUtils; show path on Tonnetz
6. `<ScaleBuilder>` — auto (2-prime circulation) + manual Tonnetz picker
7. `costFunction.js` + `<CostTable>` display with param sliders
8. `annealing.worker.js` — Web Worker with full annealing loop; posts
   {temperature, totalCost, snapshot?} messages; supports pause/stop
9. `<CompositionPanel>` — wire up worker, EnergyGraph, SnapshotList,
   RuntimeEstimate, start/pause/stop controls
10. `rhythmUtils.js` + `audioEngine.js` — score to note events to sound
11. `<OutputPanel>` — FoldedScore SVG, playback controls, snapshot selector
12. Polish, accessibility, Tailwind theming

---

## Important Implementation Notes

- **Annealing in Web Worker is non-negotiable** — runs millions of
  iterations, will freeze the UI on the main thread. Use postMessage
  for progress (temperature, cost) and snapshot data. Support pause
  (stop iterating but keep state) and stop (terminate worker).

- **Snapshot system is critical** — the whole UX depends on the user
  being able to browse results at different temperatures. Each snapshot
  needs a full copy of scoreArray. At ~10,000 note events of Int16,
  one snapshot is ~20KB — storing 20 snapshots is fine.

- **commas_best.txt loading** — fetch once on app load, parse into a
  JS array, store in React context. The file is ~700KB. Parse lazily
  if needed. Do not re-fetch or re-parse on every render.

- **Monzo arithmetic uses BigInt** — numerators/denominators of comma
  ratios can exceed Number.MAX_SAFE_INTEGER easily. Use BigInt for all
  ratio arithmetic. Cents values use regular Float64.

- **Wrapping neighbors** — neighbor lookup at position [v][i1]...[in]
  wraps: neighbor at dimension k is [(ik + 1) % dk] and [(ik - 1 + dk) % dk].
  This is essential for the physics to work correctly.

- **Cost table validation** — after computing the cost table, display
  the actual min and max values. If the range is not roughly 0.1–10,
  prompt the user to adjust `power` or `maxPQ`. Jim does this manually
  by printing the table; the UI makes it visual.

- **Prime > 13 warning** — commas_best.txt only covers primes 2,3,5,7,
  11,13. If user adds prime 17+, warn that comma filtering is unavailable
  and the user must construct the scale and comma manually.

- **Audio context on gesture** — create AudioContext only after a user
  click (browser security requirement). Never create it on page load.

- **Score array flattening** — store as a flat TypedArray with shape
  metadata. For shape [3,4,4,4], index [v][i][j][k] maps to
  v*64 + i*16 + j*4 + k. Compute strides from shape on init.

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
