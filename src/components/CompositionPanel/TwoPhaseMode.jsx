/**
 * Two-Phase Mode controls (Step 5). Off by default: the usual single run.
 * On: Jim's recommended workflow for a seeded piece — Phase 1 cools
 * slowly from a random start while the app watches the energy graph
 * for the transition temperature (the knuckle); Phase 2 restarts from
 * the comma-traversal seed at exactly that temperature, fixed.
 */
export default function TwoPhaseMode({
  enabled, onToggle,
  phase, tTransition,
  commaName, seedSource, motifName,
  isRunning,
  onStartPhase2, onSetTransitionHere,
}) {
  const fmtT = t => (t >= 10 ? `${Math.round(t)}` : t.toFixed(1))
  const seedLabel = seedSource === 'motif'
    ? `the motif (${motifName})`
    : seedSource === 'traversal'
      ? `the ${commaName} traversal`
      : 'the scale itself'

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2.5 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-violet-600 cursor-pointer"
        />
        <span className="space-y-0.5">
          <span className="text-sm text-slate-700 dark:text-slate-300 block">
            Two-Phase Mode
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 block">
            Jim&apos;s recommended workflow for a seeded piece. Phase 1 cools slowly from a
            random start while the app watches the energy graph for the transition
            temperature (the knuckle, where the cost drops sharply). Phase 2 restarts
            from the comma-traversal seed at that temperature, fixed. Off = the usual
            single run. Applies to the next run — press Start.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="space-y-3 pl-6">
          {motifName && (
            <p className="text-xs text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 rounded-md px-2.5 py-2">
              Your motif ({motifName}) is on, so Phase 2 will be seeded from the motif
              instead of the comma traversal. Phase 1 still starts from random.
              Turn the motif off and Phase 2 goes back to the traversal.
            </p>
          )}

          {phase === 'idle' && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {seedSource === 'motif'
                ? `Phase 2 will seed from the motif (${motifName}).`
                : commaName
                  ? `Phase 2 will seed from the ${commaName} traversal.`
                  : 'No comma selected — Phase 2 will seed from the scale itself. Pick a comma in Step 3 to seed from its traversal instead.'}
              {' '}Phase 1 always starts from random, so motif seeding is ignored in Phase 1.
            </p>
          )}

          {phase === 'phase1' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phase 1 — cooling from T200, watching for the knuckle…
                {isRunning
                  ? ' The run pauses by itself when a transition is found.'
                  : ' Press Start to begin.'}
              </p>
              <button
                onClick={onSetTransitionHere}
                disabled={!isRunning}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40"
              >
                Set transition here
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No knuckle in sight? Use the button above to mark the current temperature
                as the transition and move on to Phase 2.
              </p>
            </div>
          )}

          {phase === 'awaiting' && tTransition != null && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transition found at T≈{fmtT(tTransition)} — a snapshot was saved at that
                temperature. Phase 2 will restart from {seedLabel} at T≈{fmtT(tTransition)}, fixed.
              </p>
              <button
                onClick={onStartPhase2}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700"
              >
                Start Phase 2
              </button>
            </div>
          )}

          {phase === 'phase2' && tTransition != null && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Phase 2 — running at fixed T≈{fmtT(tTransition)}, seeded from {seedLabel}.
              The seed stays in the piece while the rest anneals around it.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
