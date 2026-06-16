# Neon Cyberpunk Tetris

HTML5 Canvas Tetris with synthwave/cyberpunk aesthetic, T-spins, reactive touch controls, and a procedurally synthesized WebAudio bassline.

Built with React 19, Vite, TypeScript, and Tailwind v4.
<img width="1250" height="729" alt="image" src="https://github.com/user-attachments/assets/cda2a32e-4af3-487d-a8e3-9418cd6a6c01" />

## Features

- **2-Player Local Battle** — same keyboard split-screen; garbage-line attack with official Tetris rules (B2B, T-Spin, combo bonus)
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

### 1 Player

| Action | Key |
|--------|-----|
| Move | ← / → |
| Soft drop | ↓ |
| Rotate | ↑ / X |
| Hard drop | Space |
| Hold | C |
| Pause | P |

Touch / on-screen controls also available.

### 2 Players (same keyboard)

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Move | ← / → | A / D |
| Soft drop | ↓ | S |
| Rotate | ↑ | W |
| Hard drop | Space | Left Shift |
| Hold | C | Q |
| Pause (both) | P / Esc | P / Esc |

### 2-Player Attack Rules (Tetris Guideline)

| Clear | Lines sent |
|-------|-----------|
| Single | 0 |
| Double | 1 |
| Triple | 2 |
| Tetris | 4 |
| T-Spin Single | 2 |
| T-Spin Double | 4 |
| T-Spin Triple | 6 |
| Back-to-Back bonus | +1 |
| Combo | varies |
