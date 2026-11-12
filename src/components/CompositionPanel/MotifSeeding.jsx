import {
  PRESET_MOTIFS, DEFAULT_PRESET_ID, MAX_MOTIF_NOTES,
  getPresetMotif, resolveMotif, playTone, playMotif, motifDegreeToHz,
} from '../../utils/motifUtils'

/**
 * Motif seeding controls (Step 5). Off by default: the annealer starts
 * from pure noise, as before. On: a short phrase is planted into the
 * score, so the piece grows around a recognisable tune.
 */
export default function MotifSeeding({ motif, onChange, scale, edo }) {
  const m = motif ?? { enabled: false, source: 'preset', presetId: DEFAULT_PRESET_ID, customDegrees: [] }
  const N = scale?.length ?? 0
  const degrees = resolveMotif(m) ?? []
  const preset = m.source === 'preset' ? getPresetMotif(m.presetId ?? DEFAULT_PRESET_ID) : null

  const set = patch => onChange({ ...m, ...patch })

  // Genres in first-appearance order, for the <select> groups.
  const genres = [...new Set(PRESET_MOTIFS.map(p => p.genre))]

  function addDegree(d) {
    const current = m.customDegrees ?? []
    if (current.length >= MAX_MOTIF_NOTES) return
    playTone(motifDegreeToHz(d, scale, edo))
    set({ source: 'custom', customDegrees: [...current, d] })
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2.5 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={m.enabled}
          onChange={e => set({ enabled: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded accent-violet-600 cursor-pointer"
        />
        <span className="space-y-0.5">
          <span className="text-sm text-slate-700 dark:text-slate-300 block">
            Seed with a motif
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 block">
            Plants a short phrase into the score and keeps it there, so the piece grows
            around a recognisable tune instead of starting from pure noise. Turning it on
            while a run is going plants the motif into the current piece.
          </span>
        </span>
      </label>

      {m.enabled && N > 0 && (
        <div className="space-y-3 pl-6">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Motifs are stored as scale degrees, so they follow whatever scale you built —
            you get the tune&apos;s shape and contour, with your scale&apos;s intervals.
          </p>

          {/* Preset picker / custom switch */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              Motif
            </label>
            <select
              value={m.source === 'custom' ? 'custom' : (m.presetId ?? DEFAULT_PRESET_ID)}
              onChange={e => {
                if (e.target.value === 'custom') set({ source: 'custom' })
                else set({ source: 'preset', presetId: e.target.value })
              }}
              className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {genres.map(g => (
                <optgroup key={g} label={g}>
                  {PRESET_MOTIFS.filter(p => p.genre === g).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.song}</option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">Play your own…</option>
            </select>
          </div>

          {/* Preset detail */}
          {preset && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 dark:text-slate-500">{preset.note}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {preset.degrees.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs font-mono rounded bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200">
                    {d + 1}
                  </span>
                ))}
                <button
                  onClick={() => playMotif(preset.degrees, scale, edo)}
                  className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700"
                >
                  ▶ Play
                </button>
              </div>
            </div>
          )}

          {/* Play-your-own */}
          {m.source === 'custom' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Tap the scale degrees to build your own motif — each tap plays the note and
                adds it. Up to {MAX_MOTIF_NOTES} notes.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: N }, (_, d) => (
                  <button
                    key={d}
                    disabled={(m.customDegrees ?? []).length >= MAX_MOTIF_NOTES}
                    onClick={() => addDegree(d)}
                    className="w-9 h-8 text-sm font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-40"
                  >
                    {d + 1}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {degrees.length === 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">No notes yet.</span>
                )}
                {degrees.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs font-mono rounded bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200">
                    {d + 1}
                  </span>
                ))}
                {degrees.length > 0 && (
                  <>
                    <button
                      onClick={() => playMotif(degrees, scale, edo)}
                      className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700"
                    >
                      ▶ Play motif
                    </button>
                    <button
                      onClick={() => set({ customDegrees: [] })}
                      className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
