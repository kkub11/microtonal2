const PRESETS = [
  { label: '4×4×4', dims: [4, 4, 4] },
  { label: '6×6×6', dims: [6, 6, 6] },
  { label: '7×7×7', dims: [7, 7, 7] },
  { label: '8×8×8', dims: [8, 8, 8] },
  { label: '4×4×4×4', dims: [4, 4, 4, 4] },
]

function dimsKey(dims) { return dims.join('×') }

export default function ArrayShapeSelector({ cubeDims, onChange }) {
  const currentKey = dimsKey(cubeDims)
  const numMeasures = cubeDims.reduce((a, b) => a * b, 1)
  const isPreset = PRESETS.some(p => dimsKey(p.dims) === currentKey)

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
        Hypercube shape
        <span className="ml-2 font-normal text-slate-400 dark:text-slate-500">
          ({numMeasures.toLocaleString()} elements per voice)
        </span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button key={p.label}
            onClick={() => onChange(p.dims)}
            className={[
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
              dimsKey(p.dims) === currentKey
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
        {!isPreset && (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-violet-600 text-white">
            {currentKey}
          </span>
        )}
      </div>
      {numMeasures > 500 && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          Large system — annealing will run slower.
        </p>
      )}
    </div>
  )
}
