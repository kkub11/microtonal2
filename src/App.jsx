import { useReducer, useMemo, useState, useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { computeTuningError } from './utils/edoUtils'
import { computeCostTable } from './utils/costFunction'
import { SETTINGS_KEYS } from './utils/presets'
import Header from './components/Header'
import WorkflowStepper from './components/WorkflowStepper'
import PresetPicker from './components/PresetPicker'
import SaveSettings from './components/SaveSettings'
import TuningPanel from './components/TuningPanel'
import TonnetzPanel from './components/TonnetzPanel'
import CommaScalePanel from './components/CommaScalePanel'
import CostFunctionPanel from './components/CostFunctionPanel'
import CompositionPanel from './components/CompositionPanel'
import OutputPanel from './components/OutputPanel'

// Two top-level tabs. Settings is where the initial settings are input:
// Presets (the front door) and Advanced (the original step flow) swap
// via a sub-tab. Make music is the only place annealing runs and
// output plays — the run controls live there, nowhere else.
const VIEWS = [
  { id: 'settings', label: 'Settings' },
  { id: 'compose', label: 'Make Music' },
]
const SETTINGS_TABS = [
  { id: 'presets', label: 'Presets' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'save', label: 'Save Settings' },
]

// Advanced is the settings steps only: step 5 holds the compose
// *settings* (shape, weights, motif, two-phase, rhythm) — the run
// controls (start, preview, graphs, temperature, snapshot) and the
// output step were removed; those live in Make Music.
const STEPS = ['Tuning', 'Tonnetz', 'Scale', 'Cost', 'Compose']

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
  const [view, setView] = useState('settings')
  const [settingsTab, setSettingsTab] = useState('presets')
  // The preset the current piece started from ({ id, name, snapshotHint })
  // — display only; fine-tuning in Advanced does not clear it.
  const [activePreset, setActivePreset] = useState(null)
  // Waveform a preset carries ('f2', 'f7', …). The panels take it as
  // their initial waveform; changing it inside a panel stays local to
  // that panel until another preset is applied.
  const [presetWaveform, setPresetWaveform] = useState('sine')
  // Audio coordination for Make Music: the Output panel reports when it
  // is playing (the preview goes quiet), and a counter the App bumps on
  // every run start (the Output panel stops its playback).
  const [outputPlaying, setOutputPlaying] = useState(false)
  const [stopOutputNonce, setStopOutputNonce] = useState(0)

  // Leaving Make Music unmounts both panels (their cleanup stops the
  // audio), so a stale "output playing" flag must not mute a later run.
  useEffect(() => {
    if (view !== 'compose') setOutputPlaying(false)
  }, [view])

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
    setSettingsTab('advanced')
    dispatch({ type: 'SET_STEP', payload: 5 })
    setView('settings')
  }

  function goChangePreset() {
    setSettingsTab('presets')
    setView('settings')
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
    onPlayingChange: setOutputPlaying,
    stopRequest: stopOutputNonce,
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Header />
          {/* Top-level tabs: the active tab joins the sheet below it, so
              each view reads as a sheet of paper (bordered, rounded). */}
          <div className="pt-4">
            <div role="tablist" aria-label="Views" className="flex gap-1">
              {VIEWS.map(v => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  onClick={() => setView(v.id)}
                  className={view === v.id
                    ? 'relative z-10 -mb-px px-4 py-2 text-sm font-medium rounded-t-xl border border-b-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                    : 'px-4 py-2 text-sm rounded-t-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <main className="border border-slate-200 dark:border-slate-800 rounded-xl rounded-tl-none bg-white dark:bg-slate-900 p-4 sm:p-6">
            {view === 'settings' && (
              <>
                {/* Sub-tabs: Presets and Advanced share the Settings sheet,
                    with their own nested sheet below. */}
                <div role="tablist" aria-label="Settings" className="flex gap-1">
                  {SETTINGS_TABS.map(t => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={settingsTab === t.id}
                      onClick={() => setSettingsTab(t.id)}
                      className={settingsTab === t.id
                        ? 'relative z-10 -mb-px px-3 py-1.5 text-sm font-medium rounded-t-lg border border-b-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                        : 'px-3 py-1.5 text-sm rounded-t-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg rounded-tl-none bg-white dark:bg-slate-900 p-4 sm:p-5">

                {settingsTab === 'presets' && (
                  <PresetPicker onApply={handleApplyPreset} />
                )}

                {settingsTab === 'save' && (
                  <SaveSettings
                    currentState={state}
                    currentWaveform={presetWaveform}
                    onApply={handleApplyPreset}
                  />
                )}

                {settingsTab === 'advanced' && (
                  <>
                    <WorkflowStepper
                      steps={STEPS}
                      currentStep={state.currentStep}
                      onStepClick={(step) => dispatch({ type: 'SET_STEP', payload: step })}
                    />
                    <div className="pt-4">
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
                        <CompositionPanel {...compositionProps} mode="settings" />
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
                    </div>
                  </>
                )}
                </div>
              </>
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
                      No preset picked yet — choose one in Settings first.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={goChangePreset}
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
                    <CompositionPanel
                      {...compositionProps}
                      mode="run"
                      previewMuted={outputPlaying}
                      onRunStart={() => setStopOutputNonce(n => n + 1)}
                    />
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
                      onClick={goChangePreset}
                      className="mt-3 px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                    >
                      Browse presets
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
          </div>
        </div>
      </div>
      <Analytics />
    </>
  )
}
