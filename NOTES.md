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

The PRIMARY interaction model (per Jim) is:
  Start the annealing → drag a temperature slider → listen in real time.
This is exactly like Jim's thermodynamics demo:
  https://interdependentscience.blogspot.com/2018/11/thermodynamics.html
The user finds the musical sweet spot by ear, not by reading graphs.

**Tech stack:** React, Tailwind CSS, Web Audio API.
**Data file:** `public/commas_best.txt` (29,999 lines, included in repo).
**Start simple:** implement the simplest version of each feature first.
Jim's advice: "Start simple is good!"

---

## Core Concepts (read before touching any algorithm code)

### EDO (Equal Division of the Octave)
Divide the octave into N equal steps. Frequency of step k:
  freq = baseHz * 2^(k / edo)
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
  3:2  = perfect fifth      (~702 cents)
  5:4  = major third        (~386 cents)
  7:4  = harmonic seventh   (~969 cents)
  11:8 = eleventh harmonic  (~551 cents)
  13:8 = thirteenth harmonic (~841 cents)

### Tuning error
How closely an EDO approximates a just ratio.
  bestStep = round(edo * log2(p/q))
  error = |edo * log2(p/q) - bestStep|  (fractions of one EDO step)
Small error = good approximation.

### Tonnetz
A 2D grid where each cell is an EDO pitch class label.
Moving right = one interval (e.g. a fifth = 31 steps in 53-EDO).
Moving up = another interval (e.g. a major third = 17 steps in 53-EDO).
The axes are user-configurable — any two intervals from the prime set.
Conventional default: x = perfect fifth (3:2), y = major third (5:4).

IMPORTANT: The Tonnetz must be large enough to show the repeating
pattern of pitch class labels that appears when a comma is tempered
out. The bigger the EDO, the more cells are needed to see this pattern.
The TonnetzGrid must be scrollable and zoomable, not a fixed-size grid.
The repeating pattern IS the visual signature of comma temperament.

### Comma
A very small interval: the gap left when a cycle of just intervals
fails to close exactly. Example: four perfect fifths + major third
≠ two octaves; the gap is the syntonic comma (81:80).

In an EDO, certain commas are "tempered out" — rounded to zero, so
the cycle closes. This makes comma traversal possible: a path of
intervals that would drift in just intonation returns to the start
in the EDO.

### Comma file format (`commas_best.txt`)
Each line: [e2 e3 e5 e7 e11 e13 > bestEdo
The comma = 2^e2 * 3^e3 * 5^e5 * 7^e7 * 11^e11 * 13^e13
bestEdo = the EDO Jim recommends for traversing this comma.
29,999 entries. EDOs range from 12 to 1992.
Note: the file only covers primes up to 13. Commas involving primes
17+ would need to be computed separately.

### Scale
A subset of EDO pitch classes, ordered within one octave.
Built by stacking a generator interval on the Tonnetz.
Aim for reasonably even spacing between successive notes.
For two-prime commas: can be computed algorithmically (circulation).
For three-or-more-prime commas: user selects notes manually on Tonnetz.

### Interval cost function
A precomputed N×N table (N = scale size) of costs between every pair
of scale degrees. Low cost = consonant (preferred by annealing).
See full algorithm below.

### Score array
A multi-dimensional array of pitch assignments.
Shape: [numVoices][d1][d2]...[dn] where d1*d2*...*dn = numMeasures.
Example: 3 voices, 6×6×6 = 216 measures → shape [3][6][6][6].
Each element = an index into the scale (0..N-1).
Neighbors in ANY dimension are harmonically related.
Neighbor topology WRAPS — position 0 and position d-1 are neighbors.
This wrapping + multidimensional structure causes phase transitions
and fractal self-similarity.

### Annealing algorithm
Iteratively reassigns pitches to minimize total cost.
Each note event has neighbors in all hypercube dimensions plus
cross-voice neighbors. Temperature controls randomness.
The user controls temperature directly via a slider in real time.
The sweet spot near the phase transition produces fractal fluctuations
which are musically interesting — the user finds this by ear.

### Measures and rhythm
Measures are a rhythmic scaffolding used to generate a network of
timed note events. The annealing algorithm is completely unaware of
measures — it only sees the score array (a flat network of pitch
nodes). Key facts confirmed from Jim's actual score file:

- All measures are the same fixed length (~5 seconds is a good default)
- Each measure is recursively subdivided into note events
- Pitches VARY within a measure — the score array has one element per
  note event, not one per measure. The full score array covers ALL
  note events across ALL voices across ALL measures.
- Voices are fully simultaneous and independent — they all play from
  time 0 to end time, with completely independent rhythmic patterns
- Different voices can have very different numbers of note events
  (confirmed: i3=1984, i4=1530, i5=2873 notes in the sample file)
- The total number of note events equals the total number of elements
  in the score array: numVoices × d1 × d2 × ... × dn

---

## Real Score File Format (CSound)

Confirmed from Jim's actual file `99edo_porwell_8x8x8.txt`:

**Line 1 (metadata comment):**
  ; temp = 442.24286675821; cost = 4065252.51483713
  This encodes the snapshot temperature and total system cost.
  The app should write and read this format for import/export.

**Lines 2–8 (CSound instrument tables, f-statements):**
  f1..f6: wavetable definitions (harmonic series amplitudes).
  These define the timbre of each instrument (voice).
  For Web Audio, these map to custom PeriodicWave definitions,
  or can be approximated with OscillatorNode waveform types.

**Note lines (i-statements):**
  i{instrument} {startSec} {durationSec} {freqRatio} {loudness}

  instrument: i3, i4, i5 = voices 1, 2, 3 (i-number = instrument index)
  startSec:   absolute start time in seconds
  durationSec: note duration in seconds
  freqRatio:  frequency as a RATIO multiplied by reference pitch in
              the orchestra file. Jim currently uses 72 Hz as reference.
              actual Hz = freqRatio * 72
              freqRatio = 2^(edoStep / edo)
              Confirmed: all ratios map to exact integer EDO steps.
  loudness:   amplitude scalar (range ~906–1366 in Jim's files).
              For Web Audio GainNode, normalize to ~0.1–0.8 range.

**Confirmed properties of the sample file (99-EDO, 8×8×8, 3 voices):**
  Total note events: 6,387
  Total duration:    ~2,736 seconds (45.6 minutes)
  Measure length:    ~5.34 seconds (2736 / 512 measures)
  Base duration:     ~0.3206 sec = 1/3 sec (all durations are rational
                     multiples of this: ×1, ×1.5, ×2, ×3, ×3.75, ×4.5,
                     ×5, ×7.5 etc — produced by recursive subdivision)
  Frequency range:   0.82 to 9.60 (ratio) = 59 to 692 Hz at 72 Hz ref
  EDO steps range:   -28 to ~+250 (spanning ~3.5 octaves above 72 Hz)
  Unique durations:  18 distinct values (from recursive subdivision)

---

## Data Structures

```javascript
// Tuning setup
const tuning = {
  edo: 99,
  baseHz: 72,           // Jim's reference pitch. Default 72 Hz.
  primes: [2, 3, 5, 7], // can include 11, 13, 17, or any prime
};

// A just interval
const justInterval = {
  ratio: [3, 2],        // p:q
  cents: 701.96,
  name: "perfect fifth",
  color: "green",       // for Tonnetz display
};

// A comma entry (parsed from commas_best.txt)
const comma = {
  monzo: [4, -10, 5, 0, -1, 1], // exponents of [2,3,5,7,11,13]
  bestEdo: 494,
  cents: 0.0,              // computed: 1200 * sum(e_i * log2(p_i))
  ratioString: "...",      // computed from monzo using BigInt
  primeSet: [2,3,5,11,13], // which primes appear (non-zero exponents)
};

// Scale: ordered EDO step indices within one octave
const scale = [0, 17, 31, 48, 62, ...]; // length N

// Interval cost table
// costTable[i*N + j] = cost of interval from scale[i] to scale[j]
// Low = consonant (preferred). Range approximately 0.1 to 10.
const costTable = new Float32Array(N * N);

// Score array (flattened, shape stored separately)
// Each element is a scale index (0..N-1) for ONE note event.
// Total elements = numVoices × d1 × d2 × ... × dn
// = total note events across all voices and all measures.
const scoreArray = new Int16Array(numVoices * d1 * d2 * d3);
const scoreShape = [3, 6, 6, 6]; // [voices, ...hypercube dimensions]
// Index [v][i][j][k] → v*216 + i*36 + j*6 + k
// Strides computed from shape on initialization.

// A snapshot (saved state of the annealing run)
const snapshot = {
  temperature: 442.24,
  totalCost: 4065252.5,
  scoreArray: new Int16Array(...), // full copy at this moment
  scoreShape: [3, 6, 6, 6],
  edo: 99,
  baseHz: 72,
  scale: [0, 13, 26, ...],
};

// A rhythmic event (one note event's timing, per voice per measure)
const rhythmEvent = {
  startSec: 0.0,        // absolute start time
  durationSec: 0.320,   // duration in seconds
  isRest: false,
};

// Note event (rhythm + pitch combined, for audio playback)
const noteEvent = {
  freqHz: 118.4,        // baseHz * 2^(edoStep / edo)
  startSec: 0.0,
  durationSec: 0.801,
  isRest: false,
  voice: 0,
  gainValue: 0.4,       // normalized from Jim's loudness scalar
};
```

---

## Algorithm: Interval Cost Function

Jim's exact method, from his emails:

**Step 1: Enumerate candidate just intervals**
For each combination of primes from the selected prime set, enumerate
all ratios p:q where p and q are within maxPQ. Find all ratios whose
cents value is within ±50 cents of the EDO interval being scored.
Include ratios in ascending and descending form.

**Step 2: Tenney harmonic distance**
  tenney(p, q) = log2(p * q)
Simple intervals: low value (3:2 → 2.58). Complex: high (81:80 → 13).

**Step 3: Proximity factor**
  proximityFactor = exp(-proximityK * abs(justCents - edoCents))
Just intervals far from the EDO interval contribute less.

**Step 4: Consonance contribution**
  consonance = proximityFactor / pow(tenney(p, q), power)
power spreads scores. Small (~1.0) for few primes, larger (~2–3) for
many primes. Counteracts flattening from more just intervals per step.

**Step 5: Sum, floored at 0.001**
  score[i][j] = 0.001 + sum(consonance for all matching just ratios)
Floor ensures no interval ever gets score zero.

**Step 6: Invert to cost**
  cost[i][j] = 1.0 / score[i][j]

**Step 7: Validate range**
Display computed min/max. Let user adjust power and maxPQ until
the range is approximately 0.1 to 10.

**User-adjustable parameters:**
  power      (slider 0.5–4.0): spreads score range
  maxPQ      (number input):   limits which just ratios are considered
  proximityK (slider):         strictness of just-ratio matching

---

## Algorithm: Full Cost Function for Annealing

The cost of assigning pitch p to a note event has FOUR terms:

**Term 1: Harmonic neighbor cost**
For each neighbor in the score hypercube (wrapping in all dimensions):
  cost += costTable[p * N + neighborPitch]
Main musical term. All neighbors in all dimensions should be consonant.

**Term 2: Voice range cost**
  cost += rangeWeight * (p - voiceCenter)^2
Keeps voices from drifting too far from their center pitch.

**Term 3: Melodic jump cost**
  cost += jumpWeight * stepDistance(p, prevPitch) * costTable[p][prevPitch]
Penalizes large leaps, but modulated by consonance — a consonant
octave leap can be preferred over a dissonant half-step.

**Term 4: Thematic similarity cost**
When the same position appears in two different phrase repetitions,
the melodic interval leading into it should match between repetitions.
  expectedPitch = b1 + (a2 - a1)   // transpose snippet A's interval to B
  cost += thematicWeight * costTable[p * N + expectedPitch]
Encodes melodic shape preservation across phrase variations.

**Weight parameters (user-adjustable):**
  rangeWeight, jumpWeight, thematicWeight

---

## Algorithm: Simulated Annealing

```
1. Initialize scoreArray randomly (or with comma traversal seed)
2. User sets temperature T via slider (real-time control)
3. Run continuously in Web Worker:
   a. Pick a random note event (voice + position in hypercube)
   b. For each candidate pitch in the scale, compute total cost
      (all 4 terms)
   c. Assign pitch using weighted random:
        weight(p) = exp(-cost(p) / T)
   d. Every ~10,000 iterations:
      - Compute total system cost
      - Send {temperature: T, totalCost} to main thread via postMessage
4. Main thread updates energy display and plays audio in real time
5. User drags temperature slider to find the musical sweet spot
6. User can take a snapshot at any time to save the current state
```

**Temperature control:**
The user controls T directly via a slider — this is the PRIMARY
interaction. There is no automatic cooling schedule for the interactive
mode. The user drags the slider from high (chaotic/random) to low
(ordered/tonal) and listens for the phase transition sweet spot.
Optional: an "auto-cool" mode that slowly reduces T for unattended runs.

**System size:**
Start with small systems: 6×6×6 = 216 measures is a good default.
Small systems run fast enough for real-time interactive use in a
browser Web Worker. Larger systems (up to 16×16 or 4×4×4×4) can be
offered but with a warning that they run slower.

**Neighbor topology (WRAPS):**
Each note event at [v][i1][i2]...[in] has neighbors:
  For each dimension k: positions ik±1 (mod dk) — WRAPS AROUND
  Cross-voice: same position, adjacent voice (also wraps)
Total ~5–7 neighbors per note event.
Wrapping creates the toroidal topology essential for phase transitions.

**Initialization:**
  Random: fully random pitch assignments
  Seeded: initialize with a comma traversal pattern

---

## Snapshot System

The annealing runs continuously. The user can save snapshots at any
time to capture the score at a particular temperature.

- Snapshot = full copy of scoreArray + temperature + totalCost + tuning
- Multiple snapshots can be stored and compared
- OutputPanel shows whichever snapshot is selected
- The annealing can be paused, resumed, or reset at any time

**Export format (CSound-compatible):**
Line 1: ; temp = {temperature}; cost = {totalCost}
Lines 2–N: i{voice+2} {startSec} {durationSec} {freqRatio} {loudness}
freqRatio = 2^(edoStep / edo)   (multiply by baseHz in playback)
This format is directly importable into CSound for high-quality render.

**Import:** app can read Jim's existing .txt score files and play them
back via Web Audio, using the same format as above.

---

## Algorithm: Rhythm and Duration

**How the rhythm system works:**
The rhythm system generates a flat list of (startSec, durationSec)
pairs — one per note event per voice. These are then zipped with the
score array (which provides the pitch for each event) to produce the
final note events for playback.

Each voice gets its own independently generated rhythm sequence.
The total number of rhythm events per voice must equal
d1 × d2 × ... × dn (the number of measures in the hypercube).

**Measure length:** fixed, user-sets in seconds. Default: 5 seconds.

**Simple version (implement first):**
  - Same divisor for every measure (e.g. always ÷4)
  - No joining: all notes equal length within a measure
  - No rests
  - noteDuration = measureSec / divisor

**Full version (implement after simple version works):**
  Recursive subdivision with joining (confirmed from score file analysis:
  18 unique duration values, all rational multiples of 1/3 sec base):
  1. Divide measure into n equal parts (n = 2, 3, 4, or 5)
  2. Randomly join adjacent parts (e.g. join 0+1 → 2/3 + 1/3 of measure)
  3. For each resulting slot, recursively subdivide if > minNoteSec
  4. Stop recursing when slot < minNoteSec
  5. Rest probability increases for shorter notes
  6. Multiple patterns possible; each measure picks one
     (e.g. 90% pattern A, 10% pattern B)
  7. Patterns are generated independently per voice

**Pitch assignment:**
After rhythm generation, zip rhythm events with the flattened score
array. Event k in voice v gets pitch scoreArray[v * numMeasures + k].
Every note event has its own pitch — pitches vary freely within and
across measures.

**Reference pitch:** 72 Hz (Jim's standard). User-adjustable.
**Frequency formula:** freqHz = baseHz * 2^(edoStep / edo)

---

## Audio Synthesis (Web Audio API)

**Per-note synthesis:**
- OscillatorNode with waveform (sine / triangle / sawtooth, or custom)
- GainNode for amplitude envelope and loudness
- Schedule via audioCtx.currentTime + startSec offset
- NEVER use setTimeout for audio timing
- Create AudioContext only after user gesture (browser requirement)

**Custom waveforms (from Jim's f-tables):**
Jim's CSound f-statements define harmonic series for each voice.
Example f2: harmonics [1, 0.5, 0.3, 0.25, 0.2, 0.167, ...]
These can be loaded into Web Audio PeriodicWave for accurate timbre.
The app should offer: sine (simplest), built-in waveforms, and
optionally Jim's exact f-table waveforms as named presets.

**Amplitude:**
Jim's loudness values (906–1366) are CSound amplitude scalars.
Normalize to Web Audio gain: gain = (loudness - 900) / 500 * 0.7 + 0.1
Or use a fixed gain (e.g. 0.3) for simplicity in v1.

**Envelope:**
Short attack (5ms) + sustain + short release (20ms) to avoid clicks.
Use GainNode.gain.linearRampToValueAtTime for envelope shaping.

**Voices:**
All voices play simultaneously from time 0. Each voice is an
independent stream of scheduled OscillatorNode + GainNode pairs.
Use a separate GainNode per voice for per-voice volume control.
Connect all voice gains to a master GainNode → audioCtx.destination.

---

## EDO Selector Design

Two modes:
1. Preset dropdown with named EDOs Jim has used:
   12  (standard Western, baseline)
   19  (meantone, conventional note names work)
   22  (magic comma territory)
   34  (diaschisma temperament)
   53  (Pythagorean/Hanson, very accurate fifths)
   65, 87, 99, 114
   494 (very high precision)
   612 (extreme precision)
2. Custom number input for any EDO

Jim's note: below 100 is "already a vast universe."

---

## Prime Selector Design

1. Standard quick-toggle buttons: 3, 5, 7, 11, 13
2. "Add prime" text input — validate that entry is actually prime
3. Display custom primes alongside standard ones with a remove button
4. If user selects prime > 13: warn that comma file does not cover
   these primes, comma filtering will be unavailable

---

## Tonnetz Grid Design

- Scrollable and zoomable canvas (not a fixed-size SVG)
- Must be large enough to show the repeating label pattern when a
  comma is tempered out — the repetition IS the visual signature
- The bigger the EDO, the larger the grid needs to be
- Cells show EDO pitch class numbers (or note names if mappable)
- Colored arrows show interval directions (one color per interval type)
  Standard colors (from Jim's blog): green = fifths, blue = major thirds,
  red = 7:4 intervals. Extend with more colors for 11, 13, etc.
- User can click cells to select pitches for manual scale building
- Comma traversal path is highlighted as a colored trail on the grid

**Comma path must be ZIGZAG, not L-shaped:**
Jim explicitly said the current L-shaped path display is awkward.
The correct approach interspersed the two interval types rather than
doing all of one then all of the other. For example, for a comma
involving fifths and major thirds, the path should alternate:
  fifth → third → fifth → third → ...
not: fifth → fifth → fifth → third → third → third

The zigzag path is also a better visual hint for scale construction,
since the scale is built by fattening the zigzag path.

**Multi-prime commas and the 2D Tonnetz limitation:**
A 2D Tonnetz only has two axes. A comma involving three or more
interval types (e.g. 126:125 involving primes 3, 5, and 7) cannot
be fully represented on a 2D grid. Options:
  a) Show the path projected onto the two selected Tonnetz axes,
     with a warning that the projection is partial
  b) Allow the user to pick which two of the three+ intervals to
     display, and show how the path moves along those two axes
  c) Show a separate "spiral" layout (see below) as an alternative
Jim recommends 31-EDO with primes [3,5,7] and comma 126:125 as the
canonical test case for this multi-prime challenge.

**Spiral layout (alternative to grid):**
From the "Conventionally Unconventional" post: instead of a standard
rectangular grid, notes can be arranged in a spiral that prioritizes
chains of major thirds (or whichever interval the user cares about
most). This is useful for scales built from chains of fifths where
major third relationships are still important. Consider offering
both a grid view and a spiral view as toggle options.

**Arrow colors for all interval types:**
  green  = perfect fifth  (3:2)
  blue   = major third    (5:4)
  red    = 7:4 interval
  orange = 11:8 interval
  purple = 13:8 interval
  (extend as needed for higher primes)

---

## Component Architecture

```
<App>
├── <Header />
├── <WorkflowStepper steps={1..6} current={step} />
│
├── [Step 1] <TuningPanel>
│   ├── <EdoSelector />         preset dropdown + custom input
│   ├── <PrimeSelector />       standard toggles + custom prime input
│   └── <TuningErrorTable />    computed grid of interval approximations
│
├── [Step 2] <TonnetzPanel>
│   ├── <AxisPicker axis="x" /> pick x-axis interval from prime set
│   ├── <AxisPicker axis="y" /> pick y-axis interval from prime set
│   └── <TonnetzGrid />         scrollable/zoomable canvas; colored arrows
│
├── [Step 3] <CommaScalePanel>
│   ├── <CommaList />           filtered by primes + edo; warn if >13
│   ├── <CommaDetail />         path on Tonnetz, size in cents
│   └── <ScaleBuilder />        auto (2-prime) or manual (3+ prime)
│
├── [Step 4] <CostFunctionPanel>
│   ├── <CostParams />          power, maxPQ, proximityK sliders
│   ├── <CostTable />           colored N×N grid, shows min/max
│   └── <VoiceSettings />       center pitch + range per voice
│
├── [Step 5] <CompositionPanel>
│   ├── <ArrayShapeSelector />  6×6×6 default; up to 16×16 or 4^4
│   ├── <VoiceCountSelector />  1–4 voices
│   ├── <RhythmSettings />      measure duration (sec), divisors,
│   │                           min note duration, rest probability
│   ├── <WeightSliders />       rangeWeight, jumpWeight, thematicWeight
│   ├── <StartStopButton />     start / pause / reset annealing worker
│   ├── <TemperatureSlider />   PRIMARY CONTROL — drag to find sweet spot
│   ├── <EnergyDisplay />       live total cost readout
│   └── <SnapshotButton />      save current state; list of snapshots
│
└── [Step 6] <OutputPanel>
    ├── <SnapshotSelector />    pick which snapshot to display/play
    ├── <FoldedScore />         SVG: time on x, pitch mod octave on y
    ├── <PlaybackControls />    play/pause/stop, tempo scale
    ├── <WaveformSelector />    sine/triangle/sawtooth/Jim's f-tables
    ├── <ExportButton />        export as CSound .txt score file
    ├── <ImportButton />        import Jim's existing .txt score files
    └── <AudioEngine />         invisible Web Audio API manager
```

---

## File Structure

```
src/
  utils/
    edoUtils.js       frequency math, tuning error computation
    commaUtils.js     parse commas_best.txt, filter, monzo math (BigInt)
    costFunction.js   interval cost table builder
    annealing.js      annealing step logic (called from worker)
    audioEngine.js    Web Audio API scheduler and voice manager
    rhythmUtils.js    measure subdivision, joining, rest probability
    primeUtils.js     isPrime, primality validation
    csoundIO.js       import/export CSound .txt score file format
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
      TonnetzGrid.jsx       scrollable/zoomable canvas
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
      RhythmSettings.jsx
      WeightSliders.jsx
      StartStopButton.jsx
      TemperatureSlider.jsx
      EnergyDisplay.jsx
      SnapshotButton.jsx
      SnapshotList.jsx
    OutputPanel/
      index.jsx
      SnapshotSelector.jsx
      FoldedScore.jsx
      PlaybackControls.jsx
      WaveformSelector.jsx
      ExportButton.jsx
      ImportButton.jsx
      AudioEngine.jsx
  workers/
    annealing.worker.js   Web Worker: continuous annealing loop,
                          responds to SET_TEMPERATURE messages,
                          posts {totalCost, iteration} to main thread,
                          responds to SNAPSHOT request with scoreArray copy,
                          responds to PAUSE / RESET commands
  App.jsx
  main.jsx
public/
  commas_best.txt         runtime data — loaded by the app at startup
reference/
  53edo_commas2.txt       validation reference only — NOT loaded at runtime.
                          Jim's pre-computed comma list for 53-EDO.
                          Use this to verify that commaUtils.js filterByEdo()
                          produces correct results: run the filter on
                          commas_best.txt for edo=53 and check that the
                          schisma, kleisma, and other entries from this file
                          appear in the output. Write a test for this.
```

---

## Build Order (one Claude Code session per item)

Session 1 (TuningPanel) is DONE. Continue from session 2.

1. ~~TuningPanel~~ DONE
2. primeUtils.js + update PrimeSelector to support custom prime input
3. commaUtils.js — parse file, monzoToCents, monzoToRatio (BigInt),
   filterCommas by primes and edo
4. TonnetzGrid — scrollable/zoomable canvas, configurable axes,
   colored interval arrows, repeating pitch class labels
5. CommaList + CommaDetail — filterable comma selector, path on Tonnetz
6. ScaleBuilder — auto (2-prime circulation) + manual Tonnetz picker
7. costFunction.js + CostTable display with param sliders
8. annealing.worker.js — continuous loop, SET_TEMPERATURE / SNAPSHOT /
   PAUSE / RESET message protocol, posts cost updates to main thread
9. CompositionPanel — TemperatureSlider (primary control), EnergyDisplay,
   SnapshotButton/List, StartStopButton, all wired to worker
10. rhythmUtils.js — simple version first (fixed divisor, equal notes,
    no rests); then recursive subdivision with joining
11. csoundIO.js — export score as CSound .txt; import existing files
12. audioEngine.js — zip rhythm + scoreArray → noteEvents → Web Audio;
    per-voice gain; PeriodicWave from f-tables
13. OutputPanel — FoldedScore SVG, playback, snapshot selector,
    export/import buttons
14. Polish, Tailwind theming, accessibility

---

## Implementation Notes

**Reference pitch is 72 Hz:**
Jim's orchestra file multiplies freqRatio by 72 Hz. This is the
default baseHz. freqRatio = 2^(edoStep / edo). Confirmed: every
ratio in the sample file maps to an exact integer EDO step.

**Voices are fully simultaneous:**
All voices play from time 0 to end simultaneously. Confirmed from
the sample file: i3, i4, i5 all span 0 to 2736 seconds. The Web
Audio scheduler must handle all voices concurrently. Use a GainNode
per voice connected to a master output GainNode.

**Voice note counts are unequal:**
Different voices have different numbers of note events (1984, 1530,
2873 in the sample). The rhythm system generates independently per
voice. Each voice's total events = d1 × d2 × ... × dn (measures),
but within those measures, subdivision produces different counts.
The different voice note counts (1984, 1530, 2873) reflect independent
per-voice rhythm generation, with each measure subdivided into multiple
events. 512 measures × ~4 avg subdivisions ≈ 2048 events per voice,
consistent with the observed counts.

The score array has one pitch element per vertex (one per measure per
voice). Each measure is then subdivided by the rhythm system into
multiple timed note events. Pitches VARY within a measure — each
subdivided event gets its own pitch from the score array, because
the score array has one vertex per note event, not one per measure.
(Confirmed by Jim: "yeah, pitches vary within a measure, for sure!")

**Annealing worker message protocol:**
  Main → Worker: { type: 'SET_TEMPERATURE', value: T }
  Main → Worker: { type: 'SNAPSHOT' }
  Main → Worker: { type: 'PAUSE' }
  Main → Worker: { type: 'RESUME' }
  Main → Worker: { type: 'RESET' }
  Worker → Main: { type: 'PROGRESS', temperature: T, totalCost: C }
  Worker → Main: { type: 'SNAPSHOT', scoreArray, scoreShape, temperature, totalCost }

**Wrapping neighbors (essential):**
Neighbor at dimension k: [(ik + 1) % dk] and [(ik - 1 + dk) % dk].
Without wrapping the phase transition does not occur.

**Score array indexing:**
Flat TypedArray. For shape [3,6,6,6], strides = [216, 36, 6, 1].
index(v,i,j,k) = v*216 + i*36 + j*6 + k

**BigInt for comma ratios:**
Use BigInt for numerator/denominator arithmetic. Cents = Float64.

**Audio context on gesture only:**
Create AudioContext only after a user click. Never on page load.

**Cost table range validation:**
Show actual min/max after computing. Target range: ~0.1 to ~10.

**Prime > 13 warning:**
commas_best.txt covers only primes 2,3,5,7,11,13. Warn if exceeded.

**CSound import:**
When importing Jim's .txt files, parse line 1 for temp/cost metadata,
skip f-statement lines, parse all i-statement lines into noteEvents.
freqHz = freqRatio * 72 (or user-specified baseHz).

**Simple rhythm first:**
Fixed divisor, equal durations, no rests. Get audio working first.
Add recursive subdivision only after simple version is verified.

---

## Algorithm: Scale Building

Jim's scale building process has two phases: path construction and
fattening. Both are now well understood from his emails and blog posts.

### Phase 1: Construct a Zigzag Comma Path

Starting from pitch class 0, follow the comma's monzo as a path on
the Tonnetz, but ZIGZAG between interval types rather than doing all
of one then all of the other.

For a comma with monzo [a, b] (meaning a steps of interval X and b
steps of interval Y on the Tonnetz axes):
  - Distribute the steps as evenly as possible, alternating X and Y
  - Example: [4, -3] → X, Y⁻¹, X, Y⁻¹, X, Y⁻¹, X (4 X-steps, 3 Y-steps)
  - NOT: X, X, X, X, Y⁻¹, Y⁻¹, Y⁻¹ (the L-shape Jim criticized)

The path must end on a cell with the same label as the start (e.g.
pitch class 0 → pitch class 0), confirming the comma is tempered out.

For commas involving 3+ interval types, project onto the 2D Tonnetz
axes chosen by the user, with a warning that the path is a projection.

### Phase 2: Fatten the Path

Starting from the zigzag path, add neighboring cells to the scale:
1. For each cell in the path, consider its Tonnetz neighbors
2. Add neighbors that improve the evenness of scale step sizes
3. Target step size criteria (from Jim's email):
   - MINIMUM step: ~1/24 octave (~50 cents, a quarter-tone)
     Steps smaller than this are too small to be useful
   - MAXIMUM step-size ratio: no more than ~3:1 between the
     smallest and largest steps in the scale
   - The syntonic comma (~23 cents, ~1/53 octave) is explicitly
     TOO SMALL to be a usable scale step — warn the user if it appears
4. Keep adding neighbors until quality criteria are met or no
   improvement is possible

### Scale Quality Metrics to Display

Show these in the ScaleBuilder UI so the user can evaluate the scale:
- List of step sizes in cents
- Minimum and maximum step size
- Step size ratio (max/min) — flag if > 3
- Smallest step in cents — flag if < 50 cents
- Number of notes in scale

### Test Case: 31-EDO with primes [3,5,7], comma 126:125

Jim recommended this as the canonical test for multi-prime scale
building. 126:125 = 2¹ × 3² × 7¹ : 5³ = monzo [1, 2, -3, 1, 0, 0].
It involves three primes (3, 5, 7) so the Tonnetz projection applies.
The app should handle this case gracefully, and the resulting scale
should be musically interesting (Jim uses it).

---

## Key Blog Posts for Reference

- Interactive annealing demo (the UX model to follow):
  https://interdependentscience.blogspot.com/2018/11/thermodynamics.html
- Algorithm overview (Oct 2025):
  https://interdependentscience.blogspot.com/2025/10/emergent-order.html
- Original fractal music (2015):
  https://interdependentscience.blogspot.com/2015/09/fractal-music.html
- Interval comparison / thematic cost term:
  https://interdependentscience.blogspot.com/2025/01/comparing-intervals.html
- Extended consonance (7,11,13):
  https://interdependentscience.blogspot.com/2026/02/extended-consonance.html
- Scale circulation method:
  https://interdependentscience.blogspot.com/2024/12/circulating-and-traversing.html
- Comma traversal example:
  https://interdependentscience.blogspot.com/2026/02/magic.html
- Rhythmic structure:
  https://interdependentscience.blogspot.com/2026/01/tamp-it-down.html
- All parameters described:
  https://interdependentscience.blogspot.com/2026/01/lost-in-space.html
- 31-EDO 12-note scale (Tonnetz with 7:4 arrows):
  https://interdependentscience.blogspot.com/2025/11/12-note-scale-in-31edo.html
- 31-EDO 19-note scale (spiral layout):
  https://interdependentscience.blogspot.com/2025/11/conventionally-unconventional.html

---

## Comma Selection and Filtering (Critical Update)

### The 53edo Commas File (`53edo_commas2.txt`)

Jim provided this file as the result of his own code computing all
musically relevant commas for 53-EDO specifically. It is the ground
truth for validating the app's comma filtering logic.

**This file is a VALIDATION REFERENCE, not a runtime data source.**
The app does NOT load or read this file at runtime. Instead:
- Place it in the `reference/` folder of the project
- Use it to write a test for `commaUtils.js`:
  filter `commas_best.txt` using `isTempered(monzo, 53)` and verify
  that the schisma, kleisma, and other entries from this file appear
  in the filtered output. If the test passes, the algorithm is correct.
- This is the primary correctness check for the comma filtering system.

Format of each line in the file:
  {ratio} = {cents_signed}, {monzo}
Example:
  32768:32805 = -1.953720787934038, [15 -8 -1 0 0 0 >

The file contains 474 commas for 53-EDO. Key observations:
- Only 3 commas involve only primes up to 5 (the "simplest" commas)
- 25 commas involve primes up to 7
- 103 commas involve primes up to 11
- 343 commas involve primes up to 13
- Filtering by prime selection drastically reduces the list

**Well-known commas confirmed present:**
- Schisma:  32768:32805 = 1.95¢  monzo=[15,-8,-1,0,0,0]  (primes 3,5)
- Kleisma:  15552:15625 = 8.11¢  monzo=[6,5,-6,0,0,0]    (primes 3,5)

These are the "usual choices" Jim said were missing from the app's
current comma list. The schisma and kleisma are the two most important
commas for 53-EDO and should always appear prominently.

### Why the Current App's Comma List Is Wrong

Jim said: "I do not see the usual choices in this list." The problem
is that `commas_best.txt` is a general file where each comma is paired
with its BEST EDO. When filtered for 53-EDO, it returns only commas
whose bestEdo field equals 53. But 53-EDO also tempers out commas
whose bestEdo is some other value — the schisma's bestEdo is not 53,
yet 53-EDO tempers it out perfectly well.

### The Correct Filtering Approach

A comma is tempered out by an EDO if and only if the EDO maps the
comma to zero steps — i.e., the comma's size in EDO steps rounds to 0.

  stepsForComma = sum(monzo[i] * bestStep(edo, prime[i]))
  isTempered = (stepsForComma == 0)

where bestStep(edo, p) = round(edo * log2(p)) for each prime p.

The correct algorithm for building the comma list for a given EDO:
1. For each comma in commas_best.txt (or computed dynamically):
   a. Compute how many EDO steps it maps to
   b. If exactly 0 steps: this comma IS tempered out by this EDO
   c. Include it in the filtered list
2. Additionally filter by selected prime set (only include commas
   whose non-zero monzo entries correspond to selected primes)
3. Sort by comma size in cents (smaller = simpler = more musical)
4. Limit to a practical number (Jim says "around half a dozen" is
   usually good enough)

This is a significant change from the current approach of filtering
by bestEdo == selectedEdo.

### Default Comma Suggestions Per EDO

For well-known EDOs, the app should suggest the canonical commas
by name. Known named commas to include:

| Name          | Ratio       | Cents  | Monzo           | EDOs              |
|---------------|-------------|--------|-----------------|-------------------|
| Schisma       | 32805:32768 | 1.95¢  | [-15,8,1,0,0,0] | 53, 118, and more |
| Kleisma       | 15625:15552 | 8.11¢  | [-6,-5,6,0,0,0] | 53, 72, and more  |
| Syntonic comma| 81:80       | 21.51¢ | [-4,4,-1,0,0,0] | 12, 19, 31...     |
| Marvel comma  | 225:224     | 7.71¢  | [-5,2,2,-1,0,0] | 22, 31, and more  |
| Porwell comma | (7-limit)   | varies | varies          | 99 (Jim used)     |

The Wikipedia links Jim sent confirm these names:
  https://en.wikipedia.org/wiki/Kleisma
  https://en.wikipedia.org/wiki/Schisma
  http://www.tonalsoft.com/enc/s/semicomma.aspx

### Tonnetz Visualization of Comma Tempering

Jim's Email 2 clarifies how the Tonnetz should display commas:
"When the tuning tempers out a comma, the path that corresponds to
the comma should start and stop on cells with the SAME LABEL."

This means:
- In 53-EDO with the schisma tempered out, following the schisma path
  on the Tonnetz should end on another cell labeled "0" (or whatever
  the starting pitch class is)
- The Tonnetz will have an INFINITE number of cells with each label,
  arranged in a periodic pattern
- The periodicity of label repetition IS the visual signature of
  which comma is tempered out
- The app must render enough cells to make this repetition visible
- Different commas produce different repetition patterns

This reinforces the requirement for a large, scrollable Tonnetz.

### Jim's GitHub Repository

Jim's code is at: https://github.com/kukulaj/meantone
Description: "algorithmic music in a wide variety of tunings"
Language: likely Java or Python (meantone/ subdirectory)
This is a reference for understanding his exact algorithms.
Claude Code should fetch specific files from this repo when
implementing the annealing or comma computation algorithms,
to ensure fidelity to Jim's actual approach.

### The Schisma and 53-EDO / 118-EDO

From Jim's "Naturalness" blog post (Jan 2025):
118-EDO tempers out the schisma, giving intervals even closer to
just intonation than 53-EDO. A 17-note scale built from a chain of
perfect fifths fits naturally onto a conventional keyboard with split
black keys. The schisma temperament is historically significant —
it underlies some ancient tuning systems. Jim calls it one of his
most listenable pieces.

Key insight for the app: when the user selects 53-EDO or 118-EDO
and primes [2,3,5], the schisma should appear prominently in the
comma list (it's only 1.95 cents). It should ideally be labeled
"Schisma" by name, not just shown as "32768:32805".

---

## Updates to commaUtils.js

The comma filtering function must be rewritten. Replace:
  filterCommas(commas, primes, edo) // old: filter by bestEdo == edo

With:
  isTempered(monzo, edo) // check if comma maps to 0 EDO steps
  filterByPrimes(commas, primes) // filter by selected prime set
  filterByEdo(commas, edo) // uses isTempered, not bestEdo match
  sortByCents(commas) // smallest cents first
  limitList(commas, maxCount) // keep list to ~6-20 entries

The isTempered function:
```javascript
function isTempered(monzo, edo) {
  const primes = [2, 3, 5, 7, 11, 13];
  let steps = 0;
  for (let i = 0; i < monzo.length; i++) {
    if (monzo[i] !== 0) {
      steps += monzo[i] * Math.round(edo * Math.log2(primes[i]));
    }
  }
  return steps === 0;
}
```

Also add named comma lookup: after filtering, check if each comma
matches a known named comma (by ratio or monzo) and attach the name.
