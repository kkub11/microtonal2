import { useState, useRef, useEffect, useCallback } from 'react'
import ArrayShapeSelector from './ArrayShapeSelector'
import VoiceCountSelector from './VoiceCountSelector'
import WeightSliders from './WeightSliders'
import MotifSeeding from './MotifSeeding'
import { resolveMotif, getPresetMotif } from '../../utils/motifUtils'
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
import { buildRhythmPerVoice } from '../../utils/rhythmUtils'
import WaveformSelector from '../OutputPanel/WaveformSelector'

const PREVIEW_BASE_HZ = 72
// How often the preview's unscheduled tail is rebuilt from the live
// score (ms of wall time). The annealer moves gradually, so a few
// seconds of lag between the score and the sound is inaudible — and
// the tail swap itself is free of cuts or restarts.
const PREVIEW_REFRESH_MS = 5000

function formatPreviewTime(sec) {
  if (sec == null || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

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
  // mode: 'run' — the Make-music screen (run controls only; the tuning
  // cards are hidden and the motif/two-phase cards show only when on).
  // 'settings' — Advanced step 5 (tuning cards only, no run controls).
  mode = 'run',
  initialWaveform = 'sine',
  // Audio coordination (run mode only): the Output panel reports when it
  // is playing, and the preview goes quiet while it does — the two
  // engines must never sound at once. onRunStart fires when a run
  // starts, so the Output panel can stop its playback.
  previewMuted = false,
  onRunStart,
}) {
  const workerRef           = useRef(null)
  const audioRef            = useRef(null)
  const previewRafRef       = useRef(null)
  const latestScoreRef      = useRef(null)
  const isAnnealingRef      = useRef(false)
  const previewWaveformRef  = useRef('sine')
  const previewGainRef      = useRef(0.7)
  // Streaming preview state: the rhythm is fixed for the run (built
  // once at Start), while the pitches are refreshed from the live
  // score every few seconds. previewPosRef holds the score position
  // to resume from after a pause / mute / waveform change.
  const previewRhythmRef      = useRef(null)
  const previewPosRef         = useRef(0)
  const previewLastRefreshRef = useRef(0)
  const previewPosUiRef       = useRef(0)
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
  const [previewWaveform, setPreviewWaveform] = useState(initialWaveform ?? 'sine')
  const [previewGain,     setPreviewGain]     = useState(0.7)
  // Playhead readout for the streaming preview ({ pos, total } in
  // seconds, or null when idle). Updated at most twice a second so
  // the panel is not re-rendered every animation frame.
  const [previewPos, setPreviewPos] = useState(null)

  // Two-Phase Mode progress (runtime state; the enabled toggle lives in App).
  // phase: 'idle' | 'phase1' (cooling to find the transition) |
  //        'awaiting' (knuckle found, paused, ready for Phase 2) | 'phase2'
  const [phase, setPhase]             = useState('idle')
  const phaseRef                      = useRef('idle')
  const [tTransition, setTTransition] = useState(null)
  const phaseHistoryRef               = useRef([]) // [{ temperature, cost }]
  const setPhaseBoth = p => { phaseRef.current = p; setPhase(p) }

  // What Phase 2 would seed from (recomputed when the motif/comma/scale
  // changes). Precedence — the user decides in the interface:
  //   1. the motif, when motif seeding is on (the user chose a phrase);
  //   2. the comma traversal, when a comma is selected in Step 3;
  //   3. the scale itself, cycled.
  // The motif is planted transposed per voice (its normal behaviour);
  // the traversal / scale seeds are planted untransposed.
  const phase2Motif = resolveMotif(motif)
  const phase2Traversal = traversalToDegrees(selectedComma, scale, edo, xInterval, yInterval)
  const phase2Seed = phase2Motif ?? phase2Traversal ?? scaleCycleDegrees(scale)
  const phase2SeedSource = phase2Motif != null ? 'motif'
    : phase2Traversal != null ? 'traversal' : 'scale'
  const phase2Transpose = phase2SeedSource === 'motif'
  const motifName = motif?.enabled
    ? (motif.source === 'preset' ? (getPresetMotif(motif.presetId)?.name ?? 'your motif') : 'your custom motif')
    : null

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

  // Restart the preview when the waveform changes, keeping the
  // playhead where it was, so the change is audible at once.
  // stopPreview() saves the position; the tick restarts from it.
  useEffect(() => {
    if (isAnnealingRef.current && previewOn) {
      stopPreview()
      startPreviewLoop()
    }
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

  // ─── Preview muting (audio coordination) ─────────────────────────────────
  // While the Output panel is playing its snapshot, the live preview
  // must be silent — the two engines would otherwise sound together.
  // When the output stops, the preview resumes if the run is still going.
  useEffect(() => {
    if (previewMuted) {
      stopPreview()
    } else if (previewOn && isAnnealingRef.current && status === 'running') {
      startPreviewLoop()
    }
  }, [previewMuted]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Streaming preview audio ───────────────────────────────────────────
  // One playhead walks the whole piece in order and wraps, instead of
  // rebuilding a 4-second clip of the opening over and over. The
  // rhythm is fixed for the run (built once at Start from the user's
  // actual rhythm settings — the same helper the Output panel uses),
  // so the preview sounds like the piece will sound; only the pitches
  // move, refreshed from the live score every few seconds via
  // engine.refreshEvents(), which swaps the unscheduled tail without
  // stopping anything already playing — no cut, no restart.

  function buildPreviewEvents(scoreArray, scoreShape) {
    if (!scale || !scoreArray || !previewRhythmRef.current) return []
    return buildNoteEvents(
      scoreArray, scoreShape, scale, edo, previewRhythmRef.current,
      PREVIEW_BASE_HZ, null, voiceSettingsRef.current,
    )
  }

  function startPreviewEngine(events, seekFrom) {
    const engine = audioRef.current
    if (!engine) return
    const wf  = previewWaveformRef.current
    const isF = wf.startsWith('f')
    engine.start(events, {
      waveform:   isF ? 'sine' : wf,
      harmonics:  isF ? F_TABLES[wf] : null,
      masterGain: previewGainRef.current,
      seekFrom,
    })
  }

  function startPreviewLoop() {
    cancelAnimationFrame(previewRafRef.current)
    const engine = audioRef.current
    if (!engine) return

    function tick() {
      // Keep the rolling lookahead window filled — start() only
      // schedules the first 10 s, so without this a long piece would
      // go silent after 10 s.
      engine.scheduleAhead()
      const pos   = engine.playbackPosition
      const total = engine.totalDuration
      if (total === 0) {
        // Not playing (fresh start, or stopped): begin at the saved
        // position — 0 for a new run, the pause point for a resume.
        const s = latestScoreRef.current
        if (s) {
          const events = buildPreviewEvents(s.scoreArray, s.scoreShape)
          if (events.length > 0) {
            startPreviewEngine(events, previewPosRef.current)
            previewPosRef.current = 0
          }
        }
      } else if (pos >= total) {
        // Played through the whole piece: loop from the top with
        // fresh pitches from the live score.
        const s = latestScoreRef.current
        if (s) {
          const events = buildPreviewEvents(s.scoreArray, s.scoreShape)
          if (events.length > 0) startPreviewEngine(events, 0)
        }
      } else {
        // Refresh the unscheduled tail every few seconds so the sound
        // tracks the annealing. Notes already scheduled keep playing,
        // so there is no cut or restart; if the lists ever fail to
        // line up, refreshEvents returns false and the next loop
        // point picks up the fresh pitches.
        const now = performance.now()
        if (now - previewLastRefreshRef.current >= PREVIEW_REFRESH_MS) {
          previewLastRefreshRef.current = now
          const s = latestScoreRef.current
          if (s) {
            const events = buildPreviewEvents(s.scoreArray, s.scoreShape)
            if (events.length > 0) engine.refreshEvents(events)
          }
        }
      }
      // Playhead readout, throttled so the panel re-renders at most
      // twice a second.
      const nowMs = performance.now()
      if (nowMs - previewPosUiRef.current >= 500) {
        previewPosUiRef.current = nowMs
        setPreviewPos({ pos: engine.playbackPosition, total: engine.totalDuration })
      }
      previewRafRef.current = requestAnimationFrame(tick)
    }
    previewRafRef.current = requestAnimationFrame(tick)
  }

  function stopPreview() {
    cancelAnimationFrame(previewRafRef.current)
    previewRafRef.current = null
    // Remember where the playhead was, so pause / mute / waveform
    // changes resume from the same spot instead of the top. Read
    // before stop() — afterwards the position is 0. The readout
    // keeps showing the frozen position while paused; handleReset
    // clears it.
    if (audioRef.current) previewPosRef.current = audioRef.current.playbackPosition
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
    // The preview rhythm is fixed for the run — built once from the
    // user's actual rhythm settings, so the preview sounds like the
    // piece will sound. Only the pitches move as it anneals.
    previewRhythmRef.current = buildRhythmPerVoice([voiceCount, ...cubeDims], rhythmSettings)
    previewPosRef.current = 0
    previewLastRefreshRef.current = 0
    isAnnealingRef.current = true
    if (previewOn) startPreviewLoop()

    setStatus('running')
    setEnergyBuckets(new Array(N_ENERGY_BUCKETS).fill(null))
    setHistCounts([])
    setProgress({ totalCost: null, iteration: 0 })
    // A new run takes the speakers: tell the Output panel to stop.
    onRunStart?.()
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
    // Phase 2: restart from the seed (motif > comma traversal > scale)
    // at the fixed transition temperature. The seed is planted and
    // pinned, so it stays in the piece.
    setTemp(tTransition)
    setAutoCool(false)
    setPhaseBoth('phase2')
    startWorker({ initMotif: phase2Seed, motifTranspose: phase2Transpose, temperature: tTransition })
  }

  function handleSetTransitionHere() {
    if (phaseRef.current === 'phase1') transitionFound(temperature)
  }

  function handlePauseResume() {
    if (status === 'running') {
      workerRef.current?.postMessage({ type: 'PAUSE' })
      // Pausing must silence the preview too: pausing the worker alone
      // leaves the audio engine looping the last clip.
      stopPreview()
      setStatus('paused')
    } else {
      workerRef.current?.postMessage({ type: 'RESUME' })
      setStatus('running')
      if (previewOn && !previewMuted) startPreviewLoop()
    }
  }

  function handleReset() {
    workerRef.current?.terminate()
    workerRef.current = null
    isAnnealingRef.current = false
    stopPreview()
    setStatus('idle')
    setPreviewPos(null)
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
  // The motif / two-phase cards are shared by both modes: in settings mode
  // they are always shown (that is where they get switched on); in run
  // mode only when switched on.
  const motifCard = (
    <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        Motif Seeding
      </label>
      <MotifSeeding motif={motif} onChange={handleMotif} scale={scale} edo={edo} />
    </div>
  )
  const twoPhaseCard = (
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
        motifName={motifName}
        isRunning={status === 'running'}
        onStartPhase2={handleStartPhase2}
        onSetTransitionHere={handleSetTransitionHere}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      {mode === 'settings' && (
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Step 5 — Compose
        </h2>
      )}

      {!ready && (
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Complete Steps 3 and 4 first (set a scale and compute the cost table).
          </p>
        </div>
      )}

      {ready && mode === 'settings' && (
        <>
          {/* ── Tuning cards only — no run controls in Advanced ── */}
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

          {motifCard}
          {twoPhaseCard}

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Rhythm Settings
            </label>
            <RhythmSettings rhythmSettings={rhythmSettings} onChange={onRhythmSettingsChange} />
          </div>
        </>
      )}

      {ready && mode === 'run' && (
        <>
          {motif?.enabled && motifCard}
          {twoPhase?.enabled && twoPhaseCard}

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
              {previewPos != null && previewPos.total > 0 && (
                <span data-testid="preview-position" className="tabular-nums">
                  {' '}· {formatPreviewTime(previewPos.pos)} / {formatPreviewTime(previewPos.total)}
                </span>
              )}
            </div>
          </div>

          {/* ── Live displays: Energy + Histogram ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Energy
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                Lower means more settled. Watch for the sharp drop — that
                is where the music finds its shape.
              </p>
              <EnergyDisplay progress={progress} energyBuckets={energyBuckets} />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Pitch Distribution
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                Which notes the piece is using right now. A few tall bars
                means it has found its home notes.
              </p>
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
