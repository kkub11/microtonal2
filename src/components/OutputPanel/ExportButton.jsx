import { exportCSound } from '../../utils/csoundIO'

export default function ExportButton({ snapshot, noteEvents, baseHz = 72 }) {
  const canExport = noteEvents.length > 0

  function handleExport() {
    if (!canExport) return
    const metadata = {
      temperature: snapshot?.temperature ?? 0,
      totalCost:   snapshot?.totalCost ?? 0,
    }
    const text = exportCSound(metadata, noteEvents, { baseHz })
    const blob = new Blob([text], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `score_T${metadata.temperature.toFixed(1)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={!canExport}
      className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600
                 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50
                 disabled:cursor-not-allowed transition-colors"
    >
      Export .txt
    </button>
  )
}
