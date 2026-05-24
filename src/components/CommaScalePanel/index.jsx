import CommaList from './CommaList'
import CommaDetail from './CommaDetail'
import ScaleBuilder from './ScaleBuilder'

export default function CommaScalePanel({
  edo, primes, xInterval, yInterval, selectedComma, scale, onCommaChange, onScaleChange,
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Step 3 — Comma &amp; Scale
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <CommaList
            edo={edo}
            primes={primes}
            selectedComma={selectedComma}
            onSelect={onCommaChange}
          />
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <CommaDetail
            comma={selectedComma}
            edo={edo}
            xInterval={xInterval}
            yInterval={yInterval}
          />
        </div>
      </div>

      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <ScaleBuilder
          key={selectedComma?.monzo.join(',') ?? 'none'}
          comma={selectedComma}
          edo={edo}
          primes={primes}
          xInterval={xInterval}
          yInterval={yInterval}
          scale={scale}
          onScaleChange={onScaleChange}
        />
      </div>
    </div>
  )
}
