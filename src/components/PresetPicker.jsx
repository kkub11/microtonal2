import { useState } from 'react'
import { BUILTIN_PRESETS, loadUserPresets, deleteUserPreset } from '../utils/presets'

// The new front door: pick a preset and start making music. The six-step
// flow lives under "Advanced" for anyone building from scratch; saving,
// importing and exporting settings live under "Save Settings".
//
// Props:
//   onApply(preset)  apply a preset and go to Make music
export default function PresetPicker({ onApply }) {
  const [userPresets, setUserPresets] = useState(() => loadUserPresets())
  const [deleteMsg, setDeleteMsg] = useState('')

  function handleDeleteUserPreset(id, name) {
    setUserPresets(deleteUserPreset(id))
    setDeleteMsg(`Deleted “${name}”.`)
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
          {deleteMsg && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{deleteMsg}</p>
          )}
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
