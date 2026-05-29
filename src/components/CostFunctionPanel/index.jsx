import CostParams from './CostParams'
import CostTable from './CostTable'
import VoiceSettings from './VoiceSettings'

export default function CostFunctionPanel({
  scale, edo, costTable,
  costParams, onCostParamsChange,
  voiceCount, voiceSettings, onVoiceSettingsChange,
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Step 4 — Cost Function
      </h2>

      {!scale || scale.length === 0 ? (
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Select a scale in Step 3 first.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Cost Parameters
              </label>
              <CostParams params={costParams} onChange={onCostParamsChange} />
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Voice Settings
              </label>
              <VoiceSettings
                voiceCount={voiceCount}
                voiceSettings={voiceSettings}
                onChange={onVoiceSettingsChange}
              />
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Interval Cost Table
              <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                row = from · column = to · hover for exact value
              </span>
            </label>
            <CostTable costTable={costTable} scale={scale} edo={edo} />
          </div>
        </>
      )}
    </div>
  )
}
