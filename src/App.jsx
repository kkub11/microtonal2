import { useReducer, useMemo } from 'react'
import { computeTuningError } from './utils/edoUtils'
import Header from './components/Header'
import WorkflowStepper from './components/WorkflowStepper'
import TuningPanel from './components/TuningPanel'

const STEPS = ['Tuning', 'Tonnetz', 'Scale', 'Cost', 'Compose', 'Output']

const initialState = {
  currentStep: 1,
  // Step 1
  edo: 53,
  primes: [2, 3, 5],
  // Steps 2–6 populated as we build them
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':   return { ...state, currentStep: action.payload }
    case 'SET_EDO':    return { ...state, edo: action.payload }
    case 'SET_PRIMES': return { ...state, primes: action.payload }
    default:           return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const tuningErrors = useMemo(
    () => computeTuningError(state.edo, state.primes),
    [state.edo, state.primes]
  )

  return (
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
        </main>
      </div>
    </div>
  )
}
