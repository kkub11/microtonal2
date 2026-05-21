export default function WorkflowStepper({ steps, currentStep, onStepClick }) {
  return (
    <nav aria-label="Workflow steps" className="py-5 border-b border-slate-200 dark:border-slate-800">
      {/* Circles sit in a relative container; the connector line is absolute behind them */}
      <div className="relative flex items-center justify-between">
        {/* Full-width connector line, vertically centred on the circles (h-8 = 2rem) */}
        <div className="absolute inset-x-0 top-4 h-px bg-slate-200 dark:bg-slate-800" />

        {steps.map((label, index) => {
          const num = index + 1
          const isActive = num === currentStep
          const isDone = num < currentStep

          return (
            <button
              key={label}
              onClick={() => onStepClick(num)}
              className="relative z-10 flex flex-col items-center gap-1.5 min-w-0"
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors',
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm'
                    : isDone
                      ? 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                      : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500',
                ].join(' ')}
              >
                {num}
              </span>
              <span
                className={[
                  'text-xs font-medium hidden sm:block',
                  isActive
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
