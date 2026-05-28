import { useRef } from 'react'

export default function ImportButton({ onImport }) {
  const inputRef = useRef(null)

  function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      onImport(ev.target.result)
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={handleChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600
                   hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        Import .txt
      </button>
    </>
  )
}
