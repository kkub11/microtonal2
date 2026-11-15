import { useRef, useState, useEffect, useMemo } from 'react'
import { AudioEngine as AudioEngineClass, buildNoteEvents, F_TABLES } from '../../utils/audioEngine'
import { buildRhythmPerVoice } from '../../utils/rhythmUtils'
import { importCSound } from '../../utils/csoundIO'
import SnapshotSelector from './SnapshotSelector'
import FoldedScore from './FoldedScore'
import PlaybackControls from './PlaybackControls'
import WaveformSelector from './WaveformSelector'
import ExportButton from './ExportButton'
import WavExportButton from './WavExportButton'
import SettingsExportButton from './SettingsExportButton'
import ImportButton from './ImportButton'

const BASE_HZ = 72

export default function OutputPanel({ snapshots, onSnapshotAdd, rhythmSettings, appState, initialWaveform = 'sine',
  // Audio coordination (Make-music view): the panel reports when it is
  // playing, so the live preview can go quiet, and stops its playback
  // when a new annealing run starts (stopRequest is a counter the App
  // bumps on every run start).
  onPlayingChange, stopRequest = 0 }) {
  const engineRef        = useRef(null)
  const rafRef           = useRef(null)
  const totalDurationRef = useRef(0)   // ref so rAF closure always reads latest value
  const prevTempoRef     = useRef(1.0) // tracks previous tempoScale for position conversion

  const [selectedIdx,    setSelectedIdx]    = useState(0)
  const [waveform,       setWaveform]       = useState(initialWaveform ?? 'sine')
  const [tempoScale,     setTempoScale]     = useState(1.0)
  const [isPlaying,      setIsPlaying]      = useState(false)
  const [masterGain,     setMasterGain]     = useState(0.7)
  const [playbackPos,    setPlaybackPos]    = useState(0)
  const [importedEvents, setImportedEvents] = useState(null)

  const clampedIdx       = Math.min(selectedIdx, Math.max(0, snapshots.length - 1))
  const selectedSnapshot = snapshots[clampedIdx] ?? null

  // ── Note event generation ─────────────────────────────────────────────────

  const baseNoteEvents = useMemo(() => {
    if (importedEvents) return importedEvents
    if (!selectedSnapshot?.scoreArray) return []
    const { scoreArray, scoreShape, scale, edo } = selectedSnapshot

    // One timeline shared with the live preview (same helper) — the
    // render and the preview differ only in that the render's pitches
    // are frozen at snapshot time.
    const rhythmPerVoice = buildRhythmPerVoice(scoreShape, rhythmSettings)

    return buildNoteEvents(scoreArray, scoreShape, scale, edo, rhythmPerVoice, BASE_HZ, null, selectedSnapshot.voiceSettings)
  }, [importedEvents, selectedSnapshot, rhythmSettings])

  // Apply tempo scaling — higher tempoScale → shorter durations → faster playback
  const noteEvents = useMemo(() => {
    if (tempoScale === 1.0) return baseNoteEvents
    return baseNoteEvents.map(e => ({
      ...e,
      startSec:    e.startSec    / tempoScale,
      durationSec: e.durationSec / tempoScale,
    }))
  }, [baseNoteEvents, tempoScale])

  const totalDuration = useMemo(
    () => noteEvents.reduce((m, e) => Math.max(m, e.startSec + e.durationSec), 0),
    [noteEvents]
  )

  // Keep ref in sync so the rAF closure always reads the latest value
  totalDurationRef.current = totalDuration

  // A new annealing run starting in Make music stops output playback —
  // the live preview takes over the speakers.
  useEffect(() => {
    if (stopRequest > 0) handleStop()
  }, [stopRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AudioEngine helpers ───────────────────────────────────────────────────

  function getEngine() {
    if (!engineRef.current) engineRef.current = new AudioEngineClass()
    return engineRef.current
  }

  // ── requestAnimationFrame loop ────────────────────────────────────────────

  function startRaf() {
    cancelAnimationFrame(rafRef.current)
    function tick() {
      const pos   = engineRef.current?.playbackPosition ?? 0
      const total = totalDurationRef.current
      setPlaybackPos(pos)
      engineRef.current?.scheduleAhead()   // keep rolling lookahead window filled
      if (total > 0 && pos >= total) {
        setIsPlaying(false)
        onPlayingChange?.(false)
        setPlaybackPos(0)
        rafRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function stopRaf() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  // ── Playback controls ─────────────────────────────────────────────────────

  function handlePlay(seekFrom = 0) {
    const engine = getEngine()
    const isF    = waveform.startsWith('f')
    engine.start(noteEvents, {
      waveform:  isF ? 'sine' : waveform,
      harmonics: isF ? F_TABLES[waveform] : null,
      masterGain,
      seekFrom,
    })
    setIsPlaying(true)
    onPlayingChange?.(true)
    startRaf()
  }

  function handleStop() {
    stopRaf()
    engineRef.current?.stop()
    setIsPlaying(false)
    onPlayingChange?.(false)
    setPlaybackPos(0)
  }

  function handleSeek(seekSec) {
    setPlaybackPos(seekSec)   // set immediately so scrubber doesn't snap back on pointer-up
    if (isPlaying) {
      stopRaf()
      handlePlay(seekSec)
    }
  }

  function handleMasterGainChange(value) {
    setMasterGain(value)
    engineRef.current?.setMasterGain(value)
  }

  // ── Import ────────────────────────────────────────────────────────────────

  function handleImport(text) {
    const { noteEvents: events } = importCSound(text, { baseHz: BASE_HZ })
    setImportedEvents(events)
    handleStop()
  }

  // Restart from current position whenever waveform changes mid-play
  useEffect(() => {
    if (isPlaying) handlePlay(engineRef.current?.playbackPosition ?? 0)
  }, [waveform]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restart from proportionally equivalent position when tempo changes mid-play.
  // oldPos is in the old tempo domain; multiply by (oldTempo/newTempo) to convert.
  useEffect(() => {
    if (isPlaying) {
      const oldPos  = engineRef.current?.playbackPosition ?? 0
      const newSeek = Math.max(0, oldPos * (prevTempoRef.current / tempoScale))
      handlePlay(newSeek)
    }
    prevTempoRef.current = tempoScale
  }, [tempoScale]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      engineRef.current?.destroy()
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Output</h2>
        <div className="flex items-start gap-2">
          <ImportButton onImport={handleImport} />
          <ExportButton
            snapshot={selectedSnapshot}
            noteEvents={noteEvents}
            baseHz={BASE_HZ}
          />
          <WavExportButton
            noteEvents={noteEvents}
            waveform={waveform}
            masterGain={masterGain}
            snapshot={selectedSnapshot}
          />
          <SettingsExportButton appState={appState} />
        </div>
      </div>

      {/* Snapshot selector (hidden when showing an imported file) */}
      {!importedEvents ? (
        <SnapshotSelector
          snapshots={snapshots}
          selectedIdx={clampedIdx}
          onChange={idx => { setSelectedIdx(idx); handleStop() }}
        />
      ) : (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            Showing imported file ({noteEvents.length} events)
          </span>
          <button
            onClick={() => { setImportedEvents(null); handleStop() }}
            className="text-blue-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Folded score with playhead */}
      <FoldedScore
        noteEvents={noteEvents}
        baseHz={BASE_HZ}
        playheadSec={playbackPos}
      />

      {/* Playback controls + waveform selector */}
      <div className="space-y-2">
        <PlaybackControls
          isPlaying={isPlaying}
          onPlay={() => handlePlay()}
          onStop={handleStop}
          tempoScale={tempoScale}
          onTempoChange={setTempoScale}
          masterGain={masterGain}
          onMasterGainChange={handleMasterGainChange}
          playbackPos={playbackPos}
          totalDuration={totalDuration}
          onSeek={handleSeek}
          onTestTone={() => getEngine().testTone()}
        />
        <WaveformSelector value={waveform} onChange={setWaveform} />
      </div>

      {/* Empty state */}
      {noteEvents.length === 0 && snapshots.length === 0 && !importedEvents && (
        <p className="text-sm text-slate-400 text-center py-8">
          Generate a composition in the Compose step and save a snapshot,
          or import a CSound .txt file.
        </p>
      )}
    </div>
  )
}
