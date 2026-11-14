import { useReducer, useMemo, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { computeTuningError } from './utils/edoUtils'
import { computeCostTable } from './utils/costFunction'
import { SETTINGS_KEYS } from './utils/presets'
import Header from './components/Header'
import WorkflowStepper from './components/WorkflowStepper'
import PresetPicker from './components/PresetPicker'
import TuningPanel from './components/TuningPanel'
import TonnetzPanel from './components/TonnetzPanel'
import CommaScalePanel from './components/CommaScalePanel'
import CostFunctionPanel from './components/CostFunctionPanel'
import CompositionPanel from './components/CompositionPanel'
import OutputPanel from './components/OutputPanel'

const STEPS = ['Tuning', 'Tonnetz', 'Scale', 'Cost', 'Compose', 'Output']

// Top-level views. Presets is the front door: pick a recipe and make
// music. Advanced is the original six-step flow, unchanged. Make music
// is the simplified compose screen for the active preset.
const VIEWS = [
  { id: 'presets', label: 'Presets' },
  { id: 'compose', label: 'Make music' },
  { id: 'advanced', label: 'Advanced' },
]

const initialState = {
  currentStep: 1,
  // Step 1
  edo: 53,
  primes: [2, 3, 5],
  // Step 2
  xInterval: { ratio: [3, 2] },
  yInterval: { ratio: [5, 4] },
  // Step 3
  selectedComma: null,
  scale: null,
  // Step 4 — cost defaults chosen so the table lands in a usable range:
  // power 1.0 / maxPQ 100 gives ~2.5–32 for 53-EDO MOS7 (old defaults
  // 2.0 / 20 gave 0–1000, so the interesting temperature was far from the
  // blog's 5–10 and cold annealing collapsed to a drone).
  costParams: { power: 1.0, maxPQ: 100, proximityK: 0.1 },
  voiceCount: 3,
  voiceSettings: [{ centerHz: 131 }, { centerHz: 196 }, { centerHz: 294 }],
  // Step 5
  cubeDims: [6, 6, 6],
  // Jump/thematic defaults measured on 53-EDO MOS7 at T20 (3-seed
  // averages): jump 5.0 cuts large melodic leaps from ~52% to ~35% while
  // keeping entropy ~2.0; jump 10 halves leaps again but repeats half the
  // notes; thematic 0.5 is a light motif nudge (2.0+ freezes the piece
  // into repeats, and with either weight high, cooling below ~T10
  // collapses to repeats — snapshot around T15–30). The jump term is
  // U-shaped (sequentialStepCost): steps are free, repeats cost
  // repeatCost (2.0), leaps cost d-1 — so the escape hatch is stepping,
  // not repeating.
  weights: { rangeWeight: 1.0, jumpWeight: 5.0, thematicWeight: 0.5, thematicTransposed: false },
  // motif seeding (off by default): { enabled, source: 'preset' | 'custom',
  // presetId, customDegrees } — degrees are scale degrees, so the motif
  // follows whatever scale is built
  motif: { enabled: false, source: 'preset', presetId: 'beethoven5', customDegrees: [] },
  // two-phase mode (off by default): Phase 1 cools from random to find
  // the transition temperature; Phase 2 restarts from the comma
  // traversal seed at that temperature. Off = the usual single run.
  twoPhase: { enabled: false },
  rhythmSettings: {
    mode:              'simple',  // 'simple' | 'full'
    measureSec:        5.0,
    // simple mode
    divisor:           4,
    // full mode
    allowedDivisors:   [2, 3],
    minNoteSec:        0.15,
    restProb:          0.1,
    joinProb:          0.3,
    // cap long held notes (on): no single note lasts longer than
    // DEFAULT_MAX_NOTE_SEC (2 s) — stops one pitch droning for most of
    // a slow measure; uncheck to restore the old uncapped behaviour
    capLongNotes:      true,
    // per-measure tempo variation (±10%): keeps the pulse from feeling metronomic
    measureJitter:     0.1,
    independentVoices: true,
  },
  snapshots: [],
  // Step 6 populated as we build it
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':   return { ...state, currentStep: action.payload }
    case 'SET_EDO':    return { ...state, edo: action.payload, selectedComma: null, scale: null }
    case 'SET_PRIMES':     return { ...state, primes: action.payload, selectedComma: null, scale: null }
    case 'SET_X_INTERVAL': return { ...state, xInterval: action.payload }
    case 'SET_Y_INTERVAL':   return { ...state, yInterval: action.payload }
    case 'SET_COMMA':        return { ...state, selectedComma: action.payload }
    case 'SET_SCALE':        return { ...state, scale: action.payload }
    case 'SET_COST_PARAMS':     return { ...state, costParams: action.payload }
    case 'SET_VOICE_SETTINGS':  return { ...state, voiceSettings: action.payload }
    case 'SET_VOICE_COUNT':    return { ...state, voiceCount: action.payload }
    case 'SET_CUBE_DIMS':      return { ...state, cubeDims: action.payload }
    case 'SET_WEIGHTS':        return { ...state, weights: action.payload }
    case 'SET_MOTIF':          return { ...state, motif: action.payload }
    case 'SET_TWO_PHASE':      return { ...state, twoPhase: action.payload }
    case 'SET_RHYTHM_SETTINGS': return { ...state, rhythmSettings: action.payload }
    case 'ADD_SNAPSHOT':       return { ...state, snapshots: [...state.snapshots, action.payload] }
    case 'APPLY_SETTINGS': {
      // Apply a preset (or an imported settings file): only the known
      // settings keys are taken, snapshots are cleared — a preset starts
      // a fresh piece — and the compose step becomes current.
      const patch = {}
      for (const k of SETTINGS_KEYS) {
        if (action.payload.settings[k] !== undefined) patch[k] = action.payload.settings[k]
      }
      return { ...state, ...patch, snapshots: [], currentStep: 5 }
    }
    default:                 return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [view, setView] = useState('presets')
  // The preset the current piece started from ({ id, name, snapshotHint })
  // — display only; fine-tuning in Advanced does not clear it.
  const [activePreset, setActivePreset] = useState(null)
  // Waveform a preset carries ('f2', 'f7', …). The panels take it as
  // their initial waveform; changing it inside a panel stays local to
  // that panel until another preset is applied.
  const [presetWaveform, setPresetWaveform] = useState('sine')

  const tuningErrors = useMemo(
    () => computeTuningError(state.edo, state.primes),
    [state.edo, state.primes]
  )

  const costTable = useMemo(
    () => state.scale ? computeCostTable(state.scale, state.edo, state.primes, state.costParams) : null,
    [state.scale, state.edo, state.primes, state.costParams]
  )

  function handleApplyPreset(preset) {
    dispatch({ type: 'APPLY_SETTINGS', payload: { settings: preset.settings } })
    setActivePreset({ id: preset.id, name: preset.name, snapshotHint: preset.snapshotHint ?? '' })
    setPresetWaveform(preset.waveform ?? 'sine')
    setView('compose')
  }

  function goFineTune() {
    dispatch({ type: 'SET_STEP', payload: 5 })
    setView('advanced')
  }

  const compositionProps = {
    scale: state.scale,
    edo: state.edo,
    costTable,
    voiceCount: state.voiceCount,
    onVoiceCountChange: (n) => dispatch({ type: 'SET_VOICE_COUNT', payload: n }),
    voiceSettings: state.voiceSettings,
    cubeDims: state.cubeDims,
    onCubeDimsChange: (d) => dispatch({ type: 'SET_CUBE_DIMS', payload: d }),
    weights: state.weights,
    onWeightsChange: (w) => dispatch({ type: 'SET_WEIGHTS', payload: w }),
    motif: state.motif,
    onMotifChange: (m) => dispatch({ type: 'SET_MOTIF', payload: m }),
    twoPhase: state.twoPhase,
    onTwoPhaseChange: (t) => dispatch({ type: 'SET_TWO_PHASE', payload: t }),
    selectedComma: state.selectedComma,
    xInterval: state.xInterval,
    yInterval: state.yInterval,
    rhythmSettings: state.rhythmSettings,
    onRhythmSettingsChange: (r) => dispatch({ type: 'SET_RHYTHM_SETTINGS', payload: r }),
    snapshots: state.snapshots,
    onSnapshotAdd: (s) => dispatch({ type: 'ADD_SNAPSHOT', payload: s }),
    initialWaveform: presetWaveform,
  }

  const outputProps = {
    snapshots: state.snapshots,
    onSnapshotAdd: (s) => dispatch({ type: 'ADD_SNAPSHOT', payload: s }),
    rhythmSettings: state.rhythmSettings,
    appState: state,
    initialWaveform: presetWaveform,
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Header />
          {/* Top-level navigation: presets first, Advanced last. */}
          <nav className="flex gap-1 pt-4" aria-label="Views">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                aria-current={view === v.id ? 'page' : undefined}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  view === v.id
                    ? 'bg-violet-600 text-white font-medium'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {v.label}
              </button>
            ))}
          </nav>
          <main className="py-8">
            {view === 'presets' && (
              <PresetPicker
                currentState={state}
                currentWaveform={presetWaveform}
                onApply={handleApplyPreset}
                onGoAdvanced={() => setView('advanced')}
              />
            )}

            {view === 'compose' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    {activePreset ? `Make music — ${activePreset.name}` : 'Make music'}
                  </h2>
                  {activePreset?.snapshotHint && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {activePreset.snapshotHint}
                    </p>
                  )}
                  {!state.scale && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      No preset picked yet — choose one on the Presets tab first.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => setView('presets')}
                      className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      ← Change preset
                    </button>
                    <button
                      onClick={goFineTune}
                      className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Fine-tune in Advanced →
                    </button>
                  </div>
                </div>

                {state.scale ? (
                  <>
                    <CompositionPanel {...compositionProps} simple />
                    <OutputPanel {...outputProps} />
                  </>
                ) : (
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      Pick a preset to start a piece — each one is a recipe
                      that has already been tried. Or build from scratch in
                      Advanced.
                    </p>
                    <button
                      onClick={() => setView('presets')}
                      className="mt-3 px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                    >
                      Browse presets
                    </button>
                  </div>
                )}
              </div>
            )}

            {view === 'advanced' && (
              <>
                <WorkflowStepper
                  steps={STEPS}
                  currentStep={state.currentStep}
                  onStepClick={(step) => dispatch({ type: 'SET_STEP', payload: step })}
                />
                <div className="py-8">
                  {state.currentStep === 1 && (
                    <TuningPanel
                      edo={state.edo}
                      primes={state.primes}
                      tuningErrors={tuningErrors}
                      onEdoChange={(edo) => dispatch({ type: 'SET_EDO', payload: edo })}
                      onPrimesChange={(primes) => dispatch({ type: 'SET_PRIMES', payload: primes })}
                    />
                  )}
                  {state.currentStep === 3 && (
                    <CommaScalePanel
                      edo={state.edo}
                      primes={state.primes}
                      xInterval={state.xInterval}
                      yInterval={state.yInterval}
                      selectedComma={state.selectedComma}
                      scale={state.scale}
                      costParams={state.costParams}
                      onCommaChange={(comma) => dispatch({ type: 'SET_COMMA', payload: comma })}
                      onScaleChange={(scale) => dispatch({ type: 'SET_SCALE', payload: scale })}
                      onYIntervalChange={(interval) => dispatch({ type: 'SET_Y_INTERVAL', payload: interval })}
                    />
                  )}
                  {state.currentStep === 5 && (
                    <CompositionPanel {...compositionProps} />
                  )}
                  {state.currentStep === 4 && (
                    <CostFunctionPanel
                      scale={state.scale}
                      edo={state.edo}
                      costTable={costTable}
                      costParams={state.costParams}
                      onCostParamsChange={(p) => dispatch({ type: 'SET_COST_PARAMS', payload: p })}
                      voiceCount={state.voiceCount}
                      voiceSettings={state.voiceSettings}
                      onVoiceSettingsChange={(vs) => dispatch({ type: 'SET_VOICE_SETTINGS', payload: vs })}
                    />
                  )}
                  {state.currentStep === 2 && (
                    <TonnetzPanel
                      edo={state.edo}
                      primes={state.primes}
                      xInterval={state.xInterval}
                      yInterval={state.yInterval}
                      onXChange={(interval) => dispatch({ type: 'SET_X_INTERVAL', payload: interval })}
                      onYChange={(interval) => dispatch({ type: 'SET_Y_INTERVAL', payload: interval })}
                    />
                  )}
                  {state.currentStep === 6 && (
                    <OutputPanel {...outputProps} />
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      <Analytics />
    </>
  )
}
