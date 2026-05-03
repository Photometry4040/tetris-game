# Neon Cyberpunk Tetris

HTML5 Canvas Tetris with synthwave/cyberpunk aesthetic, T-spins, reactive touch controls, and a procedurally synthesized WebAudio bassline.

Built with React 19, Vite, TypeScript, and Tailwind v4.

## Features

- T-Spin detection with back-to-back bonus
- Hold piece, ghost piece, 7-bag randomization
- Procedural WebAudio BGM (D minor pentatonic, 125 BPM) — no audio files
- **Personal best saved to localStorage** — persists across sessions
- **6 achievements** — unlocked with toast notification (테트리스 달성, 트위스터, 속도광, 만점 돌파, 연속기, 백투백)
- **Level-based visual themes** — background shifts cyan → purple → orange → white as you progress
- **Combo HUD** — live combo counter with color escalation
- **Game over highlights** — max combo, T-Spin count, Tetris count, play time

## Run Locally

Prerequisites: Node.js 20+

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

- `npm run dev` — Vite dev server (port 3000)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — TypeScript type-check (`tsc --noEmit`)
- `npm run clean` — remove `dist/`

## Deploy to Netlify

The repo includes a `netlify.toml` configured for SPA hosting.

Option A — Git integration:
1. Push to GitHub.
2. In Netlify, "Add new site" → "Import from Git" → pick the repo.
3. Build command and publish directory are auto-detected from `netlify.toml`.

Option B — CLI:
```bash
npm install -g netlify-cli
netlify deploy --build           # preview
netlify deploy --build --prod    # production
```

## Controls

- ← / → : move
- ↓ : soft drop
- ↑ / X : rotate
- Space : hard drop
- C : hold piece
- P : pause

On-screen / touch controls are also available.
