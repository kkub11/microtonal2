export default function Header() {
  return (
    <header className="flex items-center justify-between py-5 border-b border-slate-200 dark:border-slate-800">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Microtonal Composer</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Just intonation tuning &amp; composition
        </p>
      </div>
      <a
        href="#about"
        className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
      >
        About
      </a>
    </header>
  )
}
