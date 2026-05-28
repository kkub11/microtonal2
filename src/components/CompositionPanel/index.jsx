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
import { AudioEngine as AudioEngineClass, buildNoteEvents, F_TABLES } from '../../utils/audioEngine'
import { generateSimpleRhythm } from '../../utils/rhythmUtils'
import WaveformSelector from '../OutputPanel/WaveformSelector'

const MAX_HISTORY = 500

// Preview audio: short looping clip that refreshes with the latest score
const PREVIEW_MEASURES    = 4
const PREVIEW_MEASURE_SEC = 1.0
const PREVIEW_DIVISOR     = 4
const PREVIEW_BASE_HZ     = 72

export default function CompositionPanel({
  scale, edo, costTable,
  voiceCount, onVoiceCountChange,
  voiceSettings,
  cubeDims, onCubeDimsChange,
  weights, onWeightsChange,
  rhythmSettings, onRhythmSettingsChange,
  snapshots, onSnapshotAdd,
}) {
  const workerRef        = useRef(null)
  const audioRef            = useRef(null)    // AudioEngine instance
  const previewRafRef       = useRef(null)    // rAF id for the preview loop
  const latestScoreRef      = useRef(null)    // { scoreArray, scoreShape } from last PROGRESS
  const isAnnealingRef      = useRef(false)   // true while worker is running
  const previewWaveformRef  = useRef('sine')  // mirrors previewWaveform state for RAF closure
  const previewGainRef      = useRef(0.7)     // mirrors previewGain state for RAF closure

  const [status,       setStatus]   = useState('idle')  // 'idle' | 'running' | 'paused'
  const [temperature,  setTemp]     = useState(200)
  const [progress,     setProgress] = useState({ totalCost: null, iteration: 0 })
  const [energyHistory, setHistory] = useState([])
  const [autoCool,     setAutoCool] = useState(false)
  const [coolRate,     setCoolRate] = useState(0.995)
  const [previewOn,       setPreviewOn]       = useState(true)
  const [previewWaveform, setPreviewWaveform] = useState('sine')
  const [previewGain,     setPreviewGain]     = useState(0.7)

  const ready = scale && scale.length > 0 && costTable

  // Keep refs in sync so the RAF closure always reads current values
  useEffect(() => { previewWaveformRef.current = previewWaveform }, [previewWaveform])
  useEffect(() => { previewGainRef.current     = previewGain     }, [previewGain])

  // Immediately restart the clip when waveform changes so the change is audible at once
  useEffect(() => {
    if (isAnnealingRef.current && previewOn) audioRef.current?.stop()
    // stop() resets totalDuration to 0; the RAF tick will detect this and restart
  }, [previewWaveform]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => {
    workerRef.current?.terminate()
    cancelAnimationFrame(previewRafRef.current)
    audioRef.current?.destroy()
  }, [])

  // ─── Worker message handler ─────────────────────────────────────────────────
  const handleMessage = useCallback(({ data }) => {
    if (data.type === 'PROGRESS') {
      setProgress({ totalCost: data.totalCost, iteration: data.iteration })
      setHistory(prev => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        { temperature: data.temperature, cost: data.totalCost },
      ])
      if (data.scoreArray) {
        latestScoreRef.current = { scoreArray: data.scoreArray, scoreShape: data.scoreShape }
      }
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

  // ─── Preview audio ───────────────────────────────────────────────────────────

  function buildPreviewEvents(scoreArray, scoreShape) {
    if (!scale || !scoreArray) return []
    const numVoices = scoreShape[0]
    const rhythmPerVoice = Array.from({ length: numVoices }, () =>
      generateSimpleRhythm(PREVIEW_MEASURES, PREVIEW_MEASURE_SEC, PREVIEW_DIVISOR)
    )
    return buildNoteEvents(scoreArray, scoreShape, scale, edo, rhythmPerVoice, PREVIEW_BASE_HZ)
  }

  function startPreviewLoop() {
    cancelAnimationFrame(previewRafRef.current)
    const engine = audioRef.current
    if (!engine) return

    function tick() {
      const pos   = engine.playbackPosition
      const total = engine.totalDuration
      // Restart when the clip ends (or hasn't started yet — total===0)
      if (total === 0 || pos >= total - PREVIEW_END_BUFFER) {
        const s = latestScoreRef.current
        if (s) {
          const events = buildPreviewEvents(s.scoreArray, s.scoreShape)
          if (events.length > 0) {
            const wf  = previewWaveformRef.current
            const isF = wf.startsWith('f')
            engine.start(events, {
              waveform:   isF ? 'sine' : wf,
              harmonics:  isF ? F_TABLES[wf] : null,
              masterGain: previewGainRef.current,
            })
          }
        }
      }
      previewRafRef.current = requestAnimationFrame(tick)
    }
    previewRafRef.current = requestAnimationFrame(tick)
  }

  function stopPreview() {
    cancelAnimationFrame(previewRafRef.current)
    previewRafRef.current = null
    audioRef.current?.stop()
  }

  const PREVIEW_END_BUFFER = 0.08  // seconds before clip end to trigger next start

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

    // Create/resume AudioContext while inside a user-gesture handler
    if (!audioRef.current) audioRef.current = new AudioEngineClass()
    audioRef.current.prepare()
    latestScoreRef.current = null
    isAnnealingRef.current = true
    if (previewOn) startPreviewLoop()

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
    isAnnealingRef.current = false
    stopPreview()
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={previewOn}
                    onChange={e => {
                      const on = e.target.checked
                      setPreviewOn(on)
                      if (!on) stopPreview()
                      else if (isAnnealingRef.current) startPreviewLoop()
                    }}
                    className="w-4 h-4 rounded accent-violet-600"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Audio preview</span>
                </label>
                <label className="text-xs flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Volume</span>
                  <input
                    type="range" min={0} max={1} step={0.02} value={previewGain}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setPreviewGain(v)
                      previewGainRef.current = v
                      audioRef.current?.setMasterGain(v)
                    }}
                    className="w-24 accent-violet-600"
                  />
                  <span className="tabular-nums text-slate-500 dark:text-slate-400 w-8">
                    {Math.round(previewGain * 100)}%
                  </span>
                </label>
                <WaveformSelector
                  value={previewWaveform}
                  onChange={v => { setPreviewWaveform(v); previewWaveformRef.current = v }}
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
