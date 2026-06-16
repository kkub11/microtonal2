import { useRef, useState, useEffect, useMemo } from 'react'
import { AudioEngine as AudioEngineClass, buildNoteEvents, F_TABLES } from '../../utils/audioEngine'
import { generateSimpleRhythm, generateFullRhythm } from '../../utils/rhythmUtils'
import { importCSound } from '../../utils/csoundIO'
import SnapshotSelector from './SnapshotSelector'
import FoldedScore from './FoldedScore'
import PlaybackControls from './PlaybackControls'
import WaveformSelector from './WaveformSelector'
import ExportButton from './ExportButton'
import WavExportButton from './WavExportButton'
import ImportButton from './ImportButton'

const BASE_HZ = 72

export default function OutputPanel({ snapshots, onSnapshotAdd, rhythmSettings }) {
  const engineRef        = useRef(null)
  const rafRef           = useRef(null)
  const totalDurationRef = useRef(0)   // ref so rAF closure always reads latest value
  const prevTempoRef     = useRef(1.0) // tracks previous tempoScale for position conversion

  const [selectedIdx,    setSelectedIdx]    = useState(0)
  const [waveform,       setWaveform]       = useState('sine')
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
    const numMeasures = scoreShape.slice(1).reduce((a, b) => a * b, 1)
    const numVoices   = scoreShape[0]

    let rhythmPerVoice
    if (rhythmSettings.mode === 'full') {
      const fullOpts = {
        allowedDivisors: rhythmSettings.allowedDivisors,
        minNoteSec:      rhythmSettings.minNoteSec,
        restProb:        rhythmSettings.restProb,
        joinProb:        rhythmSettings.joinProb,
      }
      if (rhythmSettings.independentVoices) {
        rhythmPerVoice = Array.from({ length: numVoices }, () =>
          generateFullRhythm(numMeasures, rhythmSettings.measureSec, fullOpts)
        )
      } else {
        const shared = generateFullRhythm(numMeasures, rhythmSettings.measureSec, fullOpts)
        rhythmPerVoice = Array.from({ length: numVoices }, () => shared)
      }
    } else {
      rhythmPerVoice = Array.from({ length: numVoices }, () =>
        generateSimpleRhythm(numMeasures, rhythmSettings.measureSec, rhythmSettings.divisor)
      )
    }

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
    startRaf()
  }

  function handleStop() {
    stopRaf()
    engineRef.current?.stop()
    setIsPlaying(false)
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
        <div className="flex gap-2">
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
