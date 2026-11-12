import { useState, useRef, useEffect, useCallback } from 'react'
import ArrayShapeSelector from './ArrayShapeSelector'
import VoiceCountSelector from './VoiceCountSelector'
import WeightSliders from './WeightSliders'
import MotifSeeding from './MotifSeeding'
import { resolveMotif } from '../../utils/motifUtils'
import TwoPhaseMode from './TwoPhaseMode'
import { traversalToDegrees, scaleCycleDegrees, detectTransition } from '../../utils/twoPhaseUtils'
import { getCommaName } from '../../utils/commaUtils'
import RhythmSettings from './RhythmSettings'
import TemperatureSlider from './TemperatureSlider'
import EnergyDisplay, { N_ENERGY_BUCKETS, tempToBucket } from './EnergyDisplay'
import PitchHistogram from './PitchHistogram'
import StartStopButton from './StartStopButton'
import SnapshotButton from './SnapshotButton'
import SnapshotList from './SnapshotList'
import { AudioEngine as AudioEngineClass, buildNoteEvents, F_TABLES } from '../../utils/audioEngine'
import { generateSimpleRhythm } from '../../utils/rhythmUtils'
import WaveformSelector from '../OutputPanel/WaveformSelector'

const PREVIEW_MEASURES    = 4
const PREVIEW_MEASURE_SEC = 1.0
const PREVIEW_DIVISOR     = 4
const PREVIEW_BASE_HZ     = 72
const PREVIEW_END_BUFFER  = 0.08  // seconds before clip end to trigger next start

export default function CompositionPanel({
  scale, edo, costTable,
  voiceCount, onVoiceCountChange,
  voiceSettings,
  cubeDims, onCubeDimsChange,
  weights, onWeightsChange,
  motif, onMotifChange,
  twoPhase, onTwoPhaseChange,
  selectedComma, xInterval, yInterval,
  rhythmSettings, onRhythmSettingsChange,
  snapshots, onSnapshotAdd,
}) {
  const workerRef           = useRef(null)
  const audioRef            = useRef(null)
  const previewRafRef       = useRef(null)
  const latestScoreRef      = useRef(null)
  const isAnnealingRef      = useRef(false)
  const previewWaveformRef  = useRef('sine')
  const previewGainRef      = useRef(0.7)
  const voiceSettingsRef    = useRef(voiceSettings)
  useEffect(() => { voiceSettingsRef.current = voiceSettings }, [voiceSettings])

  const [status,        setStatus]    = useState('idle')
  const [temperature,   setTemp]      = useState(200)
  const [progress,      setProgress]  = useState({ totalCost: null, iteration: 0 })
  const [energyBuckets, setEnergyBuckets] = useState(() => new Array(N_ENERGY_BUCKETS).fill(null))
  const [histCounts,    setHistCounts] = useState([])
  const [autoCool,      setAutoCool]  = useState(false)
  const [coolRate,      setCoolRate]  = useState(0.995)
  const [previewOn,       setPreviewOn]       = useState(true)
  const [previewWaveform, setPreviewWaveform] = useState('sine')
  const [previewGain,     setPreviewGain]     = useState(0.7)

  // Two-Phase Mode progress (runtime state; the enabled toggle lives in App).
  // phase: 'idle' | 'phase1' (cooling to find the transition) |
  //        'awaiting' (knuckle found, paused, ready for Phase 2) | 'phase2'
  const [phase, setPhase]             = useState('idle')
  const phaseRef                      = useRef('idle')
  const [tTransition, setTTransition] = useState(null)
  const phaseHistoryRef               = useRef([]) // [{ temperature, cost }]
  const setPhaseBoth = p => { phaseRef.current = p; setPhase(p) }

  // What Phase 2 would seed from (recomputed when the comma/scale changes):
  // the comma traversal when a comma is selected, else the scale itself.
  const phase2Traversal = traversalToDegrees(selectedComma, scale, edo, xInterval, yInterval)
  const phase2Seed = phase2Traversal ?? scaleCycleDegrees(scale)
  const phase2SeedSource = phase2Traversal != null ? 'traversal' : 'scale'

  // Called when the transition temperature is fixed (detected knuckle or
  // manual "set transition here"): snapshot at that temperature, pause,
  // and wait for the user to start Phase 2. Uses only refs + stable
  // setters, so it is safe to call from the (possibly stale) worker
  // message handler.
  const transitionFound = useCallback(t => {
    setTTransition(t)
    phaseRef.current = 'awaiting'
    setPhase('awaiting')
    setAutoCool(false)
    workerRef.current?.postMessage({ type: 'SNAPSHOT' })
    workerRef.current?.postMessage({ type: 'PAUSE' })
    setStatus('paused')
  }, [])

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
      const bi = tempToBucket(data.temperature)
      setEnergyBuckets(prev => {
        const next = prev.slice()
        next[bi] = { temperature: data.temperature, cost: data.totalCost }
        return next
      })
      // Two-Phase Mode, Phase 1: watch the cost curve for the knuckle.
      if (phaseRef.current === 'phase1' && data.totalCost != null) {
        const h = phaseHistoryRef.current
        h.push({ temperature: data.temperature, cost: data.totalCost })
        if (h.length > 300) h.shift()
        const t = detectTransition(h)
        if (t != null) transitionFound(t)
      }
      if (data.scoreArray) {
        latestScoreRef.current = { scoreArray: data.scoreArray, scoreShape: data.scoreShape }
        const counts = new Array(scale.length).fill(0)
        for (let k = 0; k < data.scoreArray.length; k++) {
          const d = data.scoreArray[k]
          if (d >= 0 && d < scale.length) counts[d]++
        }
        setHistCounts(counts)
      }
    } else if (data.type === 'SNAPSHOT') {
      onSnapshotAdd({
        id:           Date.now(),
        timestamp:    Date.now(),
        scoreArray:   data.scoreArray,
        scoreShape:   data.scoreShape,
        temperature:  data.temperature,
        totalCost:    data.totalCost,
        iteration:    data.iteration,
        scale,
        edo,
        voiceSettings: voiceSettingsRef.current ?? [],
      })
    }
  }, [onSnapshotAdd, scale, edo, transitionFound])

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  // Find the nearest scale degree to centerHz within its octave (for annealing penalty).
  function centerHzToScaleDeg(centerHz) {
    const N      = scale.length
    const octave = Math.floor(Math.log2(centerHz / PREVIEW_BASE_HZ))
    let bestIdx = 0, bestDist = Infinity
    for (let i = 0; i < N; i++) {
      const hz   = PREVIEW_BASE_HZ * Math.pow(2, octave + scale[i] / edo)
      const dist = Math.abs(hz - centerHz)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }
    return bestIdx
  }

  // Translate Hz-based voiceSettings to scale-degree form for the annealing worker.
  function translateVoiceSettings(vs) {
    const N = scale.length
    return (vs ?? []).map(s => ({
      center: s.centerHz != null ? centerHzToScaleDeg(s.centerHz) : Math.floor(N / 2),
      range:  N,
    }))
  }

  // ─── Preview audio ───────────────────────────────────────────────────────────

  function buildPreviewEvents(scoreArray, scoreShape) {
    if (!scale || !scoreArray) return []
    const numVoices = scoreShape[0]
    const rhythmPerVoice = Array.from({ length: numVoices }, () =>
      generateSimpleRhythm(PREVIEW_MEASURES, PREVIEW_MEASURE_SEC, PREVIEW_DIVISOR)
    )
    return buildNoteEvents(
      scoreArray, scoreShape, scale, edo, rhythmPerVoice,
      PREVIEW_BASE_HZ, null, voiceSettingsRef.current,
    )
  }

  function startPreviewLoop() {
    cancelAnimationFrame(previewRafRef.current)
    const engine = audioRef.current
    if (!engine) return

    function tick() {
      const pos   = engine.playbackPosition
      const total = engine.totalDuration
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

  // ─── Controls ───────────────────────────────────────────────────────────────
  // Shared worker startup (normal runs and both two-phase phases).
  function startWorker({ initMotif, motifTranspose, temperature: startTemp }) {
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
      voiceSettings: translateVoiceSettings(voiceSettings),
      weights,
      motif:         initMotif ?? null,
      motifTranspose: motifTranspose ?? true,
      temperature:   startTemp,
    })

    if (!audioRef.current) audioRef.current = new AudioEngineClass()
    audioRef.current.prepare()
    latestScoreRef.current = null
    isAnnealingRef.current = true
    if (previewOn) startPreviewLoop()

    setStatus('running')
    setEnergyBuckets(new Array(N_ENERGY_BUCKETS).fill(null))
    setHistCounts([])
    setProgress({ totalCost: null, iteration: 0 })
  }

  function handleStart() {
    if (!ready) return
    if (twoPhase?.enabled) {
      // Phase 1: random init (NOT the motif, NOT the traversal seed),
      // cool slowly from T200 while the knuckle detector watches.
      setTemp(200)
      setAutoCool(true)
      setTTransition(null)
      phaseHistoryRef.current = []
      setPhaseBoth('phase1')
      startWorker({ initMotif: null, motifTranspose: true, temperature: 200 })
    } else {
      setPhaseBoth('idle')
      startWorker({ initMotif: resolveMotif(motif), motifTranspose: true, temperature })
    }
  }

  function handleStartPhase2() {
    if (tTransition == null) return
    // Phase 2: restart from the traversal seed (or the scale itself when
    // no comma is selected) at the fixed transition temperature. The
    // seed is planted untransposed and pinned, so it stays in the piece.
    setTemp(tTransition)
    setAutoCool(false)
    setPhaseBoth('phase2')
    startWorker({ initMotif: phase2Seed, motifTranspose: false, temperature: tTransition })
  }

  function handleSetTransitionHere() {
    if (phaseRef.current === 'phase1') transitionFound(temperature)
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
    setEnergyBuckets(new Array(N_ENERGY_BUCKETS).fill(null))
    setHistCounts([])
    setPhaseBoth('idle')
    setTTransition(null)
    phaseHistoryRef.current = []
  }

  function handleTemperature(T) {
    setTemp(T)
    workerRef.current?.postMessage({ type: 'SET_TEMPERATURE', value: T })
  }

  function handleWeights(w) {
    onWeightsChange(w)
    workerRef.current?.postMessage({ type: 'SET_WEIGHTS', value: w })
  }

  function handleMotif(m) {
    onMotifChange(m)
    workerRef.current?.postMessage({ type: 'SET_MOTIF', value: resolveMotif(m) })
  }

  function handleTwoPhaseToggle(enabled) {
    onTwoPhaseChange({ enabled })
    if (!enabled) {
      // Guided flow stops; a running worker keeps going as a normal run.
      setPhaseBoth('idle')
      setTTransition(null)
    }
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
          {/* ── Settings ── */}
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

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Motif Seeding
            </label>
            <MotifSeeding motif={motif} onChange={handleMotif} scale={scale} edo={edo} />
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Two-Phase Mode
            </label>
            <TwoPhaseMode
              enabled={twoPhase?.enabled ?? false}
              onToggle={handleTwoPhaseToggle}
              phase={phase}
              tTransition={tTransition}
              commaName={selectedComma ? getCommaName(selectedComma.monzo) : null}
              seedSource={phase2SeedSource}
              isRunning={status === 'running'}
              onStartPhase2={handleStartPhase2}
              onSetTransitionHere={handleSetTransitionHere}
            />
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Rhythm Settings
            </label>
            <RhythmSettings rhythmSettings={rhythmSettings} onChange={onRhythmSettingsChange} />
          </div>

          {/* ── Start + Audio Preview ── */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap gap-2">
              <StartStopButton
                status={status}
                disabled={!ready}
                onStart={handleStart}
                onPauseResume={handlePauseResume}
                onReset={handleReset}
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
              {status === 'idle'    && 'Press Start to begin annealing.'}
              {status === 'running' && 'Running — drag the temperature slider to find the sweet spot.'}
              {status === 'paused'  && 'Paused.'}
            </div>
          </div>

          {/* ── Live displays: Energy + Histogram ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Energy
              </label>
              <EnergyDisplay progress={progress} energyBuckets={energyBuckets} />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Pitch Distribution
              </label>
              <PitchHistogram histCounts={histCounts} />
            </div>
          </div>

          {/* ── Temperature + Snapshot ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-700 ring-1 ring-violet-200 dark:ring-violet-800">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                  Temperature
                </label>
                <span className="text-xs text-slate-400 dark:text-slate-500">primary control</span>
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

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Snapshot
              </label>
              <SnapshotButton
                disabled={status !== 'running' && status !== 'paused'}
                onSnapshot={handleSnapshot}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Save the current score at this temperature. Take multiple snapshots to compare.
              </p>
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
