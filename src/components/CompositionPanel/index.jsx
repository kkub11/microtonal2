import { useState, useRef, useEffect, useCallback } from 'react'
import ArrayShapeSelector from './ArrayShapeSelector'
import VoiceCountSelector from './VoiceCountSelector'
import WeightSliders from './WeightSliders'
import RhythmSettings from './RhythmSettings'
import TemperatureSlider from './TemperatureSlider'
import EnergyDisplay from './EnergyDisplay'
import StartStopButton from './StartStopButton'
import SnapshotButton from './SnapshotButton'
import SnapshotList from './SnapshotList'

const MAX_HISTORY = 500

export default function CompositionPanel({
  scale, edo, costTable,
  voiceCount, onVoiceCountChange,
  voiceSettings,
  cubeDims, onCubeDimsChange,
  weights, onWeightsChange,
  rhythmSettings, onRhythmSettingsChange,
  snapshots, onSnapshotAdd,
}) {
  const workerRef   = useRef(null)
  const [status,   setStatus]   = useState('idle')  // 'idle' | 'running' | 'paused'
  const [temperature, setTemp] = useState(200)
  const [progress,  setProgress] = useState({ totalCost: null, iteration: 0 })
  const [energyHistory, setHistory] = useState([])
  const [autoCool,  setAutoCool]  = useState(false)
  const [coolRate,  setCoolRate]  = useState(0.995)

  const ready = scale && scale.length > 0 && costTable

  // ─── Auto-cool timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoCool || status !== 'running') return
    const id = setInterval(() => {
      setTemp(prev => {
        const next = Math.max(0.1, prev * coolRate)
        workerRef.current?.postMessage({ type: 'SET_TEMPERATURE', value: next })
        return next
      })
    }, 100)
    return () => clearInterval(id)
  }, [autoCool, status, coolRate])

  // ─── Terminate worker on unmount ────────────────────────────────────────────
  useEffect(() => () => workerRef.current?.terminate(), [])

  // ─── Worker message handler ─────────────────────────────────────────────────
  const handleMessage = useCallback(({ data }) => {
    if (data.type === 'PROGRESS') {
      setProgress({ totalCost: data.totalCost, iteration: data.iteration })
      setHistory(prev => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        { temperature: data.temperature, cost: data.totalCost },
      ])
    } else if (data.type === 'SNAPSHOT') {
      onSnapshotAdd({
        id:         Date.now(),
        timestamp:  Date.now(),
        scoreArray: data.scoreArray,
        scoreShape: data.scoreShape,
        temperature: data.temperature,
        totalCost:   data.totalCost,
        iteration:   data.iteration,
        scale,
        edo,
      })
    }
  }, [onSnapshotAdd, scale, edo])

  // ─── Controls ───────────────────────────────────────────────────────────────
  function handleStart() {
    if (!ready) return
    workerRef.current?.terminate()

    const w = new Worker(
      new URL('../../workers/annealing.worker.js', import.meta.url),
      { type: 'module' }
    )
    w.onmessage = handleMessage
    workerRef.current = w

    w.postMessage({
      type:          'INIT',
      costTable:     new Float32Array(costTable),
      scoreShape:    [voiceCount, ...cubeDims],
      N:             scale.length,
      voiceSettings: voiceSettings ?? [],
      weights,
      temperature,
    })

    setStatus('running')
    setHistory([])
    setProgress({ totalCost: null, iteration: 0 })
  }

  function handlePauseResume() {
    if (status === 'running') {
      workerRef.current?.postMessage({ type: 'PAUSE' })
      setStatus('paused')
    } else {
      workerRef.current?.postMessage({ type: 'RESUME' })
      setStatus('running')
    }
  }

  function handleReset() {
    workerRef.current?.terminate()
    workerRef.current = null
    setStatus('idle')
    setProgress({ totalCost: null, iteration: 0 })
    setHistory([])
  }

  function handleTemperature(T) {
    setTemp(T)
    workerRef.current?.postMessage({ type: 'SET_TEMPERATURE', value: T })
  }

  function handleWeights(w) {
    onWeightsChange(w)
    workerRef.current?.postMessage({ type: 'SET_WEIGHTS', value: w })
  }

  function handleSnapshot() {
    workerRef.current?.postMessage({ type: 'SNAPSHOT' })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Step 5 — Compose
      </h2>

      {!ready && (
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Complete Steps 3 and 4 first (set a scale and compute the cost table).
          </p>
        </div>
      )}

      {ready && (
        <>
          {/* ── System configuration ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                System Shape
              </label>
              <ArrayShapeSelector cubeDims={cubeDims} onChange={onCubeDimsChange} />
              <VoiceCountSelector voiceCount={voiceCount} onChange={onVoiceCountChange} />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Annealing Weights
              </label>
              <WeightSliders weights={weights} onChange={handleWeights} />
            </div>
          </div>

          {/* ── Rhythm settings ── */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Rhythm Settings
            </label>
            <RhythmSettings rhythmSettings={rhythmSettings} onChange={onRhythmSettingsChange} />
          </div>

          {/* ── Temperature (PRIMARY) ── */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-700 ring-1 ring-violet-200 dark:ring-violet-800">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                Temperature — PRIMARY CONTROL
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">drag to find the musical sweet spot</span>
            </div>
            <TemperatureSlider
              temperature={temperature}
              onChange={handleTemperature}
              autoCool={autoCool}
              onAutoCoolChange={setAutoCool}
              coolRate={coolRate}
              onCoolRateChange={setCoolRate}
              disabled={status === 'idle'}
            />
          </div>

          {/* ── Controls + Energy ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Controls
              </label>
              <div className="flex flex-wrap gap-2">
                <StartStopButton
                  status={status}
                  disabled={!ready}
                  onStart={handleStart}
                  onPauseResume={handlePauseResume}
                  onReset={handleReset}
                />
                <SnapshotButton
                  disabled={status !== 'running' && status !== 'paused'}
                  onSnapshot={handleSnapshot}
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {status === 'idle' && 'Press Start to begin annealing.'}
                {status === 'running' && 'Running — drag the temperature slider above.'}
                {status === 'paused' && 'Paused.'}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Energy
              </label>
              <EnergyDisplay progress={progress} energyHistory={energyHistory} />
            </div>
          </div>

          {/* ── Snapshot list ── */}
          {snapshots.length > 0 && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <SnapshotList snapshots={snapshots} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
