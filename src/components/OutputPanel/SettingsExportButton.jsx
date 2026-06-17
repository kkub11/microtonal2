import { serializeSettings } from '../../utils/settingsExport'

export default function SettingsExportButton({ appState }) {
  function handleExport() {
    const text = serializeSettings(appState)
    const blob = new Blob([text], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `settings_${appState.edo}edo.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600
                 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
    >
      Export settings
    </button>
  )
}
