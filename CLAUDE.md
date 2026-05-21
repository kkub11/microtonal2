# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (Vite HMR)
npm run build        # production build
npm run preview      # preview production build locally
npm run lint         # ESLint
npm test             # run unit tests once (Vitest)
npm run test:watch   # run unit tests in watch mode
```

## Stack

- **React 19** + **Vite 8** (using `@vitejs/plugin-react` with Oxc transform)
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin (no `tailwind.config.*` file — config lives in CSS using `@theme`)
- `src/index.css` has `@import "tailwindcss"` plus a single `:root { color-scheme: light dark }` — all other styling is Tailwind utility classes
- Dark mode uses Tailwind's media-query strategy (`dark:` prefix, no class toggle needed)

## Architecture

Global app state lives in `App.jsx` via `useReducer`. Each workflow step receives only its slice of state as props — no context. Derived state (e.g. `tuningErrors`) is computed with `useMemo` in App and passed down.

```
src/
  utils/
    edoUtils.js       — getStepFreq, getBestApprox, computeTuningError
    commaUtils.js     — parseCommasText, loadCommas, monzoToRatio,
                        monzoToCents, filterCommas, commaToTonnetzPath
    commaUtils.test.js
  components/
    Header.jsx
    WorkflowStepper.jsx
    TuningPanel/
      index.jsx         — step 1 container
      EdoSelector.jsx   — number input + common-EDO quick-picks
      PrimeSelector.jsx — toggle buttons for primes 3/5/7/11/13 (2 locked)
      TuningErrorTable.jsx — color-coded grid of per-interval tuning errors
```

### Key data conventions
- **monzo** — `number[]` of prime exponents over `[2, 3, 5, 7, 11, 13]`; e.g. `[-4, 4, -1, 0, 0, 0]` = 81/80
- **`computeTuningError` return** — `errors[hi][lo]` = unsigned magnitude in EDO steps for ascending interval `hi:lo` (e.g. `errors[3][2]` = error for the perfect fifth). 0 = perfect, 0.5 = worst.
- **`commas_best.txt` score field** — this is `bestEdo`, not a quality score; lower ≠ better

## Domain: Microtonal Music

This app deals with **just intonation** and **microtonal tuning systems**. Key concepts:

- **Commas** are small musical intervals expressed as rational numbers. They are represented as prime-exponent vectors over the primes `[2, 3, 5, 7, 11, 13, ...]`. For example `[4 -4 1 0 0 0]` means `2^4 · 3^(-4) · 5^1` = `80/81` (the syntonic comma).
- `public/commas_best.txt` — a large dataset of commas with scores. Each line: `[e2 e3 e5 e7 e11 e13 > score`. The score indicates musical usefulness/simplicity; lower is generally better. This file is loaded at runtime and drives the tuning logic.
- **Temperament** — a tuning system that equates (tempers out) one or more commas, mapping just intervals to a finite scale.
