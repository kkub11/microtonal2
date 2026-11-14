import { useRef, useState } from 'react'
import {
  BUILTIN_PRESETS, loadUserPresets, saveUserPreset, deleteUserPreset,
  makeUserPresetId, parseSettingsFile, serializeSettingsFile,
  settingsFromState, validateSettings,
} from '../utils/presets'

// The new front door: pick a preset and start making music. The six-step
// flow lives under "Advanced" for anyone building from scratch.
//
// Props:
//   currentState   App reducer state (for "save current settings")
//   currentWaveform waveform the panels are using now (for export)
//   onApply(preset)  apply a preset and go to Make music
//   onGoAdvanced()   switch to the Advanced view
export default function PresetPicker({ currentState, currentWaveform, onApply, onGoAdvanced }) {
  const [userPresets, setUserPresets] = useState(() => loadUserPresets())
  const [saveName, setSaveName] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef(null)

  function handleSavePreset() {
    const name = saveName.trim()
    if (!name) { setSaveMsg('Give the preset a name first.'); return }
    const preset = {
      id: makeUserPresetId(name),
      name,
      user: true,
      blurb: 'Saved from your current settings.',
      facts: [],
      waveform: currentWaveform ?? 'sine',
      snapshotHint: '',
      settings: settingsFromState(currentState),
    }
    const list = saveUserPreset(preset)
    setUserPresets(list)
    setSaveName('')
    setSaveMsg(`Saved “${name}”. It will be here next time.`)
  }

  function handleDeleteUserPreset(id, name) {
    setUserPresets(deleteUserPreset(id))
    setSaveMsg(`Deleted “${name}”.`)
  }

  function handleExportJson() {
    const text = serializeSettingsFile({
      name: null,
      settings: settingsFromState(currentState),
      waveform: currentWaveform ?? 'sine',
    })
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'microtonal-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file) {
    setImportMsg('')
    if (!file) return
    const text = await file.text()
    const parsed = parseSettingsFile(text)
    if (!parsed.ok) { setImportMsg(parsed.error); return }
    onApply({
      id: 'imported',
      name: parsed.name ?? 'Imported settings',
      blurb: `Imported from ${file.name}.`,
      facts: [],
      waveform: parsed.waveform ?? 'sine',
      snapshotHint: 'Cool slowly to about T20, then snapshot.',
      settings: parsed.settings,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Pick a starting point
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Each preset is a whole recipe — scale, sound, speed — that has
          already been tried. Pick one, press Start, and cool it down until
          it sounds like music. You can change anything later.
        </p>
      </div>

      {/* ── Built-in presets ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BUILTIN_PRESETS.map(p => (
          <PresetCard key={p.id} preset={p} onUse={() => onApply(p)} />
        ))}
      </div>

      {/* ── Your presets ── */}
      {userPresets.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Your presets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userPresets.map(p => (
              <PresetCard
                key={p.id}
                preset={p}
                onUse={() => onApply(p)}
                onDelete={() => handleDeleteUserPreset(p.id, p.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Save / import / export ── */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Save your current settings as a preset
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={saveName}
              onChange={e => { setSaveName(e.target.value); setSaveMsg('') }}
              placeholder="Preset name, e.g. Slow minor"
              className="flex-1 min-w-48 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
            <button
              onClick={handleSavePreset}
              className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              Save preset
            </button>
          </div>
          {saveMsg && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{saveMsg}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={e => { handleImportFile(e.target.files?.[0]); e.target.value = '' }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Import settings (.json)…
          </button>
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Export current settings (.json)
          </button>
          <button
            onClick={onGoAdvanced}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Build from scratch (Advanced) →
          </button>
        </div>
        {importMsg && (
          <p className="text-xs text-red-600 dark:text-red-400">{importMsg}</p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          The .json file holds the same settings as a preset, so you can
          share a recipe with someone or keep a copy. The human-readable
          text export is still in Step 6 (Output).
        </p>
      </div>
    </div>
  )
}

function PresetCard({ preset, onUse, onDelete }) {
  return (
    <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {preset.name}
          {preset.user && (
            <span className="ml-2 text-xs font-normal text-slate-400">yours</span>
          )}
        </h3>
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label={`Delete preset ${preset.name}`}
            title="Delete this preset"
            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-lg leading-none px-1"
          >
            ×
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 flex-1">{preset.blurb}</p>
      {preset.facts?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {preset.facts.map(f => (
            <span
              key={f}
              className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            >
              {f}
            </span>
          ))}
        </div>
      )}
      <div>
        <button
          onClick={onUse}
          className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          Use this preset
        </button>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
          Starts a fresh piece — any snapshots from the current piece are cleared.
        </p>
      </div>
    </div>
  )
}
