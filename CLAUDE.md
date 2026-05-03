# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — Vite dev server on port 3000 (host `0.0.0.0`)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the built app
- `npm run lint` — type-check only (`tsc --noEmit`); no ESLint configured
- `npm run clean` — remove `dist/`

There is no test framework configured.

## Deployment

Netlify is configured via `netlify.toml` (build = `npm run build`, publish = `dist`, SPA redirect to `/index.html`, Node 20). No environment variables are required.

## Architecture

Single-page React 19 + Vite + Tailwind v4 app. The product is **Neon Cyberpunk Tetris**: an HTML5 Canvas Tetris with synthwave aesthetic, T-spins, and reactive touch controls.

- **Almost the entire game lives in `src/App.tsx`** (~950 lines): canvas render loop, piece state, scoring, T-spin detection, and an inline `AudioController` class that synthesizes a D-minor pentatonic bassline via WebAudio (no audio files). Treat `App.tsx` as the single source of truth — do not split speculatively.
- `src/main.tsx` is a trivial React root; `src/index.css` holds Tailwind entrypoints.
- `index.html` has a single `<div id="root">` and loads `/src/main.tsx`.
- Path alias `@/*` maps to the project root (`tsconfig.json` and `vite.config.ts`).

### Key bindings (in `App.tsx`)

`ArrowLeft/Right` move, `ArrowDown` soft drop, `ArrowUp`/`X` rotate, `Space` hard drop, `C` hold, `P` pause.

### Dependencies

- `lucide-react` — control icons
- `motion` — animation utility (Framer Motion successor)
- `@tailwindcss/vite` + `tailwindcss` — Tailwind v4 (no `tailwind.config.js`; use `@theme` in CSS)

## Conventions

- TypeScript with `noEmit`; "lint" = type-check.
- React 19 + StrictMode.
- The constants block at the top of `App.tsx` (`COLS`, `ROWS`, `BLOCK_SIZE`, `COLORS`, `SHAPES`, `NAMES`) defines the game's visual and mechanical contract — changes ripple through render and collision logic.
