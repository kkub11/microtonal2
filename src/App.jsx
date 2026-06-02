import { useReducer, useMemo } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { computeTuningError } from './utils/edoUtils'
import { computeCostTable } from './utils/costFunction'
import Header from './components/Header'
import WorkflowStepper from './components/WorkflowStepper'
import TuningPanel from './components/TuningPanel'
import TonnetzPanel from './components/TonnetzPanel'
import CommaScalePanel from './components/CommaScalePanel'
import CostFunctionPanel from './components/CostFunctionPanel'
import CompositionPanel from './components/CompositionPanel'
import OutputPanel from './components/OutputPanel'

const STEPS = ['Tuning', 'Tonnetz', 'Scale', 'Cost', 'Compose', 'Output']

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
  // Step 4
  costParams: { power: 2.0, maxPQ: 20, proximityK: 0.1 },
  voiceCount: 3,
  voiceSettings: [{ centerHz: 131 }, { centerHz: 196 }, { centerHz: 294 }],
  // Step 5
  cubeDims: [6, 6, 6],
  weights: { rangeWeight: 1.0, jumpWeight: 0.0, thematicWeight: 0.0 },
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
    case 'SET_RHYTHM_SETTINGS': return { ...state, rhythmSettings: action.payload }
    case 'ADD_SNAPSHOT':       return { ...state, snapshots: [...state.snapshots, action.payload] }
    default:                 return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const tuningErrors = useMemo(
    () => computeTuningError(state.edo, state.primes),
    [state.edo, state.primes]
  )

  const costTable = useMemo(
    () => state.scale ? computeCostTable(state.scale, state.edo, state.primes, state.costParams) : null,
    [state.scale, state.edo, state.primes, state.costParams]
  )

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Header />
          <WorkflowStepper
            steps={STEPS}
            currentStep={state.currentStep}
            onStepClick={(step) => dispatch({ type: 'SET_STEP', payload: step })}
          />
          <main className="py-8">
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
                onCommaChange={(comma) => dispatch({ type: 'SET_COMMA', payload: comma })}
                onScaleChange={(scale) => dispatch({ type: 'SET_SCALE', payload: scale })}
                onYIntervalChange={(interval) => dispatch({ type: 'SET_Y_INTERVAL', payload: interval })}
              />
            )}
            {state.currentStep === 5 && (
              <CompositionPanel
                scale={state.scale}
                edo={state.edo}
                costTable={costTable}
                voiceCount={state.voiceCount}
                onVoiceCountChange={(n) => dispatch({ type: 'SET_VOICE_COUNT', payload: n })}
                voiceSettings={state.voiceSettings}
                cubeDims={state.cubeDims}
                onCubeDimsChange={(d) => dispatch({ type: 'SET_CUBE_DIMS', payload: d })}
                weights={state.weights}
                onWeightsChange={(w) => dispatch({ type: 'SET_WEIGHTS', payload: w })}
                rhythmSettings={state.rhythmSettings}
                onRhythmSettingsChange={(r) => dispatch({ type: 'SET_RHYTHM_SETTINGS', payload: r })}
                snapshots={state.snapshots}
                onSnapshotAdd={(s) => dispatch({ type: 'ADD_SNAPSHOT', payload: s })}
              />
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
              <OutputPanel
                snapshots={state.snapshots}
                onSnapshotAdd={(s) => dispatch({ type: 'ADD_SNAPSHOT', payload: s })}
                rhythmSettings={state.rhythmSettings}
              />
            )}
          </main>
        </div>
      </div>
      <Analytics />
    </>
  )
}
