import { useRef, useState } from 'react'
import {
  makeUserPresetId, parseSettingsFile, saveUserPreset,
  serializeSettingsFile, settingsFromState,
} from '../utils/presets'

// The Save Settings tab: everything about keeping a recipe — save the
// current settings as a named preset (kept in this browser), export them
// as a .json file to share or keep a copy, or import a .json recipe.
//
// Props:
//   currentState   App reducer state (what gets saved/exported)
//   currentWaveform waveform the panels are using now (stored with it)
//   onApply(preset)  apply an imported preset and go to Make music
export default function SaveSettings({ currentState, currentWaveform, onApply }) {
  const [saveName, setSaveName] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef(null)

  function handleSavePreset() {
    const name = saveName.trim()
    if (!name) { setSaveMsg('Give the preset a name first.'); return }
    saveUserPreset({
      id: makeUserPresetId(name),
      name,
      user: true,
      blurb: 'Saved from your current settings.',
      facts: [],
      waveform: currentWaveform ?? 'sine',
      snapshotHint: '',
      settings: settingsFromState(currentState),
    })
    setSaveName('')
    setSaveMsg(`Saved “${name}”. Find it under Your presets on the Presets tab.`)
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
          Save settings
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Keep a recipe: save the current settings as a preset in this
          browser, share them as a .json file, or load a .json recipe
          someone shared with you.
        </p>
      </div>

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
        </div>
        {importMsg && (
          <p className="text-xs text-red-600 dark:text-red-400">{importMsg}</p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          The .json file holds the same settings as a preset, so you can
          share a recipe with someone or keep a copy. The human-readable
          text export is in Make Music, under Output.
        </p>
      </div>
    </div>
  )
}
